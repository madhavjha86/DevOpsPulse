"""AWS Cost Explorer and STS AssumeRole production billing service."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.cloud_account import CloudAccount
from app.models.cloud_cost import CloudCostItem

logger = get_logger("aws_cost_explorer")


class AWSCostExplorerService:
    """Enterprise client for authenticating AWS credentials and ingesting Cost Explorer billing data."""

    def __init__(self, cloud_account: CloudAccount) -> None:
        self.account = cloud_account
        self.credentials = self._parse_credentials(cloud_account.encrypted_credentials)

    @staticmethod
    def _parse_credentials(raw_creds: str) -> dict[str, Any]:
        """Safely parse stored JSON or key-value credentials string."""
        try:
            return json.loads(raw_creds)
        except Exception:
            # Fallback for plain text or demo keys
            return {"access_key_id": raw_creds, "secret_access_key": ""}

    def get_boto3_session(self) -> boto3.Session:
        """Create a boto3 Session, assuming an IAM role if role_arn and external_id are configured."""
        aws_access_key = self.credentials.get("aws_access_key_id") or self.credentials.get("access_key_id")
        aws_secret_key = self.credentials.get("aws_secret_access_key") or self.credentials.get("secret_access_key")
        role_arn = self.credentials.get("role_arn") or self.credentials.get("aws_role_arn")
        external_id = self.account.external_id or self.credentials.get("external_id")
        region = self.account.region or "us-east-1"

        if not aws_access_key or not aws_secret_key:
            # If no direct keys, create default unauthenticated session
            return boto3.Session(region_name=region)

        base_session = boto3.Session(
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=region,
        )

        if role_arn:
            sts_client = base_session.client("sts", region_name=region)
            assume_params: dict[str, Any] = {
                "RoleArn": role_arn,
                "RoleSessionName": f"DevOpsPulse-Org{self.account.organization_id or 1}-Sync",
            }
            if external_id:
                assume_params["ExternalId"] = external_id

            logger.info("Assuming customer IAM role for cost sync", role_arn=role_arn, external_id=external_id)
            assumed = sts_client.assume_role(**assume_params)
            temp_creds = assumed["Credentials"]

            return boto3.Session(
                aws_access_key_id=temp_creds["AccessKeyId"],
                aws_secret_access_key=temp_creds["SecretAccessKey"],
                aws_session_token=temp_creds["SessionToken"],
                region_name=region,
            )

        return base_session

    async def validate_connection(self) -> tuple[bool, str]:
        """Verify AWS credentials using STS GetCallerIdentity."""
        try:
            session = self.get_boto3_session()
            sts = session.client("sts")
            identity = sts.get_caller_identity()
            account_id = identity.get("Account")
            arn = identity.get("Arn")
            logger.info("AWS STS authentication successful", account_id=account_id, arn=arn)
            return True, f"Connected to AWS Account {account_id} ({arn})"
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "ClientError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            logger.warning("AWS STS validation client error", code=code, message=msg)
            return False, f"AWS Auth Error ({code}): {msg}"
        except BotoCoreError as e:
            logger.error("AWS STS validation connection error", error=str(e))
            return False, f"AWS Network Error: {e}"
        except Exception as e:
            logger.error("Unexpected error validating AWS credentials", error=str(e))
            return False, f"Authentication error: {e}"

    async def sync_cost_and_usage(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
        granularity: str = "DAILY",
    ) -> dict[str, Any]:
        """Ingest real Cost Explorer billing items into PostgreSQL with natural key deduplication."""
        is_valid, status_msg = await self.validate_connection()
        if not is_valid:
            self.account.last_status = "auth_error" if "Auth Error" in status_msg else "unreachable"
            self.account.error_message = status_msg
            await db.commit()
            return {
                "success": False,
                "status": self.account.last_status,
                "message": status_msg,
                "synced_records": 0,
            }

        session = self.get_boto3_session()
        ce = session.client("ce", region_name="us-east-1")  # Cost Explorer endpoint is global/us-east-1

        # AWS Cost Explorer 'End' parameter is EXCLUSIVE: end_date + 1 day
        exclusive_end = end_date + timedelta(days=1)
        time_period = {
            "Start": start_date.strftime("%Y-%m-%d"),
            "End": exclusive_end.strftime("%Y-%m-%d"),
        }

        group_by = [
            {"Type": "DIMENSION", "Key": "SERVICE"},
            {"Type": "DIMENSION", "Key": "REGION"},
            {"Type": "DIMENSION", "Key": "USAGE_TYPE"},
        ]

        metrics = ["UnblendedCost", "UsageQuantity"]
        today = date.today()
        synced_count = 0
        total_ingested_amount = 0.0

        next_token: str | None = None
        try:
            while True:
                kwargs: dict[str, Any] = {
                    "TimePeriod": time_period,
                    "Granularity": granularity,
                    "Metrics": metrics,
                    "GroupBy": group_by,
                }
                if next_token:
                    kwargs["NextPageToken"] = next_token

                response = ce.get_cost_and_usage(**kwargs)
                results_by_time = response.get("ResultsByTime", [])

                for period_result in results_by_time:
                    usage_date_str = period_result.get("TimePeriod", {}).get("Start")
                    if not usage_date_str:
                        continue
                    current_usage_date = date.fromisoformat(usage_date_str)

                    # Rolling 72-hour reconciliation: Day T and T-1 are PROVISIONAL, older are FINAL
                    day_diff = (today - current_usage_date).days
                    billing_status = "PROVISIONAL" if day_diff <= 1 else "FINAL"

                    for group in period_result.get("Groups", []):
                        keys = group.get("Keys", [])
                        service_name = keys[0] if len(keys) > 0 else "Unknown Service"
                        region_val = keys[1] if len(keys) > 1 else "global"
                        usage_type_val = keys[2] if len(keys) > 2 else "Standard"

                        metrics_data = group.get("Metrics", {})
                        unblended = metrics_data.get("UnblendedCost", {})
                        cost_amount = float(unblended.get("Amount", 0.0))
                        currency_val = unblended.get("Unit", "USD") or "USD"

                        usage_qty_data = metrics_data.get("UsageQuantity", {})
                        usage_qty = float(usage_qty_data.get("Amount", 0.0)) if "Amount" in usage_qty_data else None
                        usage_unit = usage_qty_data.get("Unit")

                        if cost_amount <= 0.0 and (usage_qty is None or usage_qty <= 0.0):
                            continue

                        # Check for existing composite natural key to update instead of duplicating
                        stmt = select(CloudCostItem).where(
                            CloudCostItem.organization_id == self.account.organization_id,
                            CloudCostItem.cloud_account_id == self.account.id,
                            CloudCostItem.provider == "AWS",
                            CloudCostItem.service_name == service_name,
                            CloudCostItem.region == region_val,
                            CloudCostItem.usage_type == usage_type_val,
                            CloudCostItem.usage_date == current_usage_date,
                            CloudCostItem.granularity == granularity,
                            CloudCostItem.currency == currency_val,
                        )
                        existing_res = await db.execute(stmt)
                        existing_item = existing_res.scalar_one_or_none()

                        if existing_item:
                            existing_item.cost_amount = cost_amount
                            existing_item.usage_quantity = usage_qty
                            existing_item.usage_unit = usage_unit
                            existing_item.billing_status = billing_status
                            existing_item.is_simulated = False
                        else:
                            new_item = CloudCostItem(
                                organization_id=self.account.organization_id,
                                user_id=self.account.user_id,
                                cloud_account_id=self.account.id,
                                provider="AWS",
                                service_name=service_name,
                                cost_amount=cost_amount,
                                currency=currency_val,
                                usage_date=current_usage_date,
                                is_simulated=False,
                                region=region_val,
                                usage_type=usage_type_val,
                                granularity=granularity,
                                billing_status=billing_status,
                                usage_quantity=usage_qty,
                                usage_unit=usage_unit,
                            )
                            db.add(new_item)

                        synced_count += 1
                        total_ingested_amount += cost_amount

                next_token = response.get("NextPageToken")
                if not next_token:
                    break

            self.account.last_status = "connected"
            self.account.last_sync_at = datetime.now(timezone.utc)
            self.account.error_message = None
            await db.commit()

            logger.info(
                "AWS Cost Explorer sync finished",
                account_id=self.account.id,
                synced_records=synced_count,
                total_cost=total_ingested_amount,
            )

            return {
                "success": True,
                "status": "connected",
                "synced_records": synced_count,
                "total_cost": round(total_ingested_amount, 2),
                "message": f"Successfully synchronized {synced_count} real AWS billing records.",
            }

        except Exception as e:
            await db.rollback()
            logger.error("Error during Cost Explorer GetCostAndUsage", error=str(e))
            self.account.last_status = "auth_error" if "AccessDenied" in str(e) else "unreachable"
            self.account.error_message = str(e)
            await db.commit()
            return {
                "success": False,
                "status": self.account.last_status,
                "message": f"Failed to retrieve AWS Cost Explorer data: {e}",
                "synced_records": 0,
            }
