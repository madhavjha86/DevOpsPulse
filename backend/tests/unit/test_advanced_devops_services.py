"""Unit tests for the 6 Advanced DevOps Capabilities."""

import pytest
from app.schemas.terminal import TerminalExecRequest
from app.services.terminal_service import TerminalService
from app.schemas.ai_remediation import AIRemediationGenerateRequest, AIRemediationActionRequest
from app.services.ai_remediation_service import AIRemediationService
from app.schemas.iac_canvas import CanvasGenerateTerraformRequest, CanvasNode, CanvasApplyRequest
from app.services.iac_canvas_service import IACCanvasService
from app.schemas.gitops import GitOpsSyncRequest, CanaryAdjustRequest
from app.services.gitops_service import GitOpsService
from app.schemas.secrets_vault import SecretCreateRequest, SecretSyncK8sRequest
from app.services.secrets_vault_service import SecretsVaultService
from app.schemas.finops_killer import TerminateResourceRequest
from app.services.finops_killer_service import FinOpsKillerService


@pytest.mark.asyncio
async def test_terminal_service_targets_and_security():
    targets = TerminalService.get_available_targets()
    assert len(targets) >= 3
    assert any(t.type == "k8s" for t in targets)

    # Test safe execution
    safe_req = TerminalExecRequest(
        target_type="k8s",
        target_id="pulse-api-deploy-74b8f9c-v9x12",
        command="kubectl get pods -n production",
    )
    res = await TerminalService.execute_command(1, "devops@example.com", safe_req)
    assert res.exit_code == 0
    assert "pulse-api" in res.output

    # Test blocked malicious command
    dangerous_req = TerminalExecRequest(
        target_type="host",
        target_id="local-host",
        command="rm -rf /",
    )
    blocked_res = await TerminalService.execute_command(1, "devops@example.com", dangerous_req)
    assert blocked_res.exit_code == 126
    assert "Security Block" in blocked_res.output


@pytest.mark.asyncio
async def test_terminal_service_filesystem_file_creation():
    target_id = "pulse-api-deploy-74b8f9c-v9x12"

    # 1. Create file with touch
    touch_req = TerminalExecRequest(target_type="k8s", target_id=target_id, command="touch test_script.py")
    res_touch = await TerminalService.execute_command(1, "devops@example.com", touch_req)
    assert res_touch.exit_code == 0

    # 2. Write code with echo >
    echo_req = TerminalExecRequest(
        target_type="k8s",
        target_id=target_id,
        command='echo "print(\'DevOpsPulse Live Terminal Output!\')" > test_script.py',
    )
    res_echo = await TerminalService.execute_command(1, "devops@example.com", echo_req)
    assert res_echo.exit_code == 0

    # 3. Read with cat
    cat_req = TerminalExecRequest(target_type="k8s", target_id=target_id, command="cat test_script.py")
    res_cat = await TerminalService.execute_command(1, "devops@example.com", cat_req)
    assert res_cat.exit_code == 0
    assert "DevOpsPulse Live Terminal Output!" in res_cat.output

    # 4. List with ls -l
    ls_req = TerminalExecRequest(target_type="k8s", target_id=target_id, command="ls -l")
    res_ls = await TerminalService.execute_command(1, "devops@example.com", ls_req)
    assert res_ls.exit_code == 0
    assert "test_script.py" in res_ls.output

    # 5. Execute with python
    py_req = TerminalExecRequest(target_type="k8s", target_id=target_id, command="python test_script.py")
    res_py = await TerminalService.execute_command(1, "devops@example.com", py_req)
    assert res_py.exit_code == 0
    assert "DevOpsPulse Live Terminal Output!" in res_py.output

    # 6. Delete with rm
    rm_req = TerminalExecRequest(target_type="k8s", target_id=target_id, command="rm test_script.py")
    res_rm = await TerminalService.execute_command(1, "devops@example.com", rm_req)
    assert res_rm.exit_code == 0


def test_ai_remediation_service():
    # List remediations
    items = AIRemediationService.list_remediations()
    assert len(items) >= 2

    # Generate OOM proposal
    oom_req = AIRemediationGenerateRequest(
        service_name="payment-worker",
        error_summary="Pod terminated with exit code 137 OOMKilled",
    )
    prop = AIRemediationService.generate_remediation_proposal(oom_req)
    assert prop.category == "K8S_RESOURCE_BUMP"
    assert "payment-worker" in prop.title

    # Approve remediation
    appr = AIRemediationService.execute_remediation(
        prop.id, "sre@example.com", AIRemediationActionRequest(notes="Approved hotfix")
    )
    assert appr.status == "EXECUTED"
    assert appr.executed_by == "sre@example.com"


def test_iac_canvas_service():
    diagrams = IACCanvasService.list_diagrams()
    assert len(diagrams) >= 1

    # Generate Terraform
    req = CanvasGenerateTerraformRequest(
        provider="aws",
        region="us-east-1",
        environment="staging",
        nodes=[
            CanvasNode(id="n1", type="vpc", label="Primary VPC", config={"cidr_block": "10.0.0.0/16"}),
            CanvasNode(id="n2", type="ec2", label="App Node", config={"instance_type": "t3.medium", "count": 2}),
            CanvasNode(id="n3", type="rds", label="Postgres DB", config={"engine": "postgres", "instance_class": "db.t3.medium", "storage": 50}),
        ],
        edges=[],
    )
    gen = IACCanvasService.generate_terraform(req)
    assert 'resource "aws_vpc"' in gen.hcl_code
    assert 'resource "aws_instance"' in gen.hcl_code
    assert 'resource "aws_db_instance"' in gen.hcl_code
    assert gen.estimated_cost_monthly_usd > 0

    # Dry-run apply
    apply_res = IACCanvasService.apply_terraform(CanvasApplyRequest(hcl_code=gen.hcl_code))
    assert apply_res.plan_status == "SUCCESS"


def test_gitops_service():
    apps = GitOpsService.list_apps()
    assert len(apps) >= 2

    # Check drift detection
    drifted = GitOpsService.get_app("app-payment-api")
    assert drifted is not None
    assert drifted.sync_status == "DriftDetected"
    assert len(drifted.drifts) > 0

    # Dry run sync
    dry_res = GitOpsService.sync_app("app-payment-api", GitOpsSyncRequest(dry_run=True))
    assert dry_res.status == "DRY_RUN"

    # Actual sync
    sync_res = GitOpsService.sync_app("app-payment-api", GitOpsSyncRequest(dry_run=False))
    assert sync_res.status == "SUCCESS"
    assert GitOpsService.get_app("app-payment-api").sync_status == "Synced"

    # Canary adjust
    canary = GitOpsService.adjust_canary("app-payment-api", CanaryAdjustRequest(weight=35))
    assert canary.canary_weight == 35
    assert canary.baseline_weight == 65


def test_secrets_vault_service():
    # List masked
    secrets = SecretsVaultService.list_secrets()
    assert len(secrets) >= 3
    assert all("••••" in s.value_masked for s in secrets)

    # Create secret
    new_sec = SecretsVaultService.create_secret(
        SecretCreateRequest(key="PAYMENT_WEBHOOK_SECRET", value="vault_secret_dummy_994182903841", environment="production")
    )
    assert new_sec.key == "PAYMENT_WEBHOOK_SECRET"

    # Reveal secret
    revealed = SecretsVaultService.reveal_secret(new_sec.id)
    assert revealed.value == "vault_secret_dummy_994182903841"

    # Leak scan
    scan = SecretsVaultService.run_leak_scan()
    assert scan.detected_leaks_count >= 1

    # Sync to K8s
    k8s_res = SecretsVaultService.sync_to_k8s(SecretSyncK8sRequest(environment="production"))
    assert k8s_res.status == "SUCCESS"
    assert k8s_res.injected_keys_count >= 1


def test_finops_killer_service():
    summary = FinOpsKillerService.get_summary()
    assert summary.total_monthly_waste_usd > 50
    assert summary.total_waste_resources_count >= 3

    # Terminate unattached EBS
    term_res = FinOpsKillerService.terminate_waste(
        TerminateResourceRequest(resource_ids=["res-ebs-1"], notes="Cleaned up abandoned volume")
    )
    assert term_res.terminated_count == 1
    assert term_res.monthly_savings_recovered_usd == 62.50
