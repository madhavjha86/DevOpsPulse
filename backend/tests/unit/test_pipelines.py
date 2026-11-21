"""Unit tests for PulseCI Pipeline Engine, models, enums, and API schemas."""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.models.pipeline import (
    Pipeline,
    PipelineRun,
    PipelineStage,
    PipelineStatus,
    PipelineTrigger,
    StageStatus,
)
from app.services.pipeline_engine import (
    PipelineEngine,
    DEFAULT_STAGES,
    _STAGE_TEMPLATES,
    _FAIL_LOGS,
    _rand_sha,
    _rand_short_sha,
)
from app.api.v1.routes.pipelines import (
    StageOut,
    RunOut,
    PipelineOut,
    PipelineCreateRequest,
    TriggerRunRequest,
)


class TestPipelineModels:
    """Validate ORM model attributes and default enum values."""

    def test_pipeline_instantiation(self):
        pipe = Pipeline(
            organization_id=1,
            name="Main Production CI/CD",
            branch="main",
            trigger=PipelineTrigger.PUSH.value,
            is_active=True,
            auto_deploy=True,
            deploy_target="kubernetes",
            stages_config=DEFAULT_STAGES,
        )
        assert pipe.name == "Main Production CI/CD"
        assert pipe.branch == "main"
        assert pipe.trigger == "PUSH"
        assert pipe.auto_deploy is True
        assert len(pipe.stages_config) == 10

    def test_pipeline_run_instantiation(self):
        now = datetime.now(timezone.utc)
        run = PipelineRun(
            pipeline_id=1,
            run_number=42,
            status=PipelineStatus.SUCCESS.value,
            trigger=PipelineTrigger.PUSH.value,
            branch="main",
            commit_sha="a" * 40,
            commit_message="feat: ship autonomous CI/CD",
            commit_author="Jane Dev",
            started_at=now,
            finished_at=now,
            duration_ms=45000,
        )
        assert run.run_number == 42
        assert run.status == "SUCCESS"
        assert run.commit_sha == "a" * 40

    def test_pipeline_stage_instantiation(self):
        stage = PipelineStage(
            run_id=1,
            name="Security Scan",
            stage_type="SECURITY_SCAN",
            order=2,
            status=StageStatus.SUCCESS.value,
            docker_image="aquasec/trivy:latest",
            logs="0 vulnerabilities found",
            exit_code=0,
            duration_ms=8500,
        )
        assert stage.name == "Security Scan"
        assert stage.stage_type == "SECURITY_SCAN"
        assert stage.exit_code == 0
        assert stage.status == "SUCCESS"


class TestPipelineEnums:
    """Validate Enum mappings for statuses and triggers."""

    def test_pipeline_status_enum_values(self):
        expected = {"QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELLED", "TIMED_OUT"}
        actual = {s.value for s in PipelineStatus}
        assert actual == expected

    def test_stage_status_enum_values(self):
        expected = {"PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED"}
        actual = {s.value for s in StageStatus}
        assert actual == expected

    def test_pipeline_trigger_enum_values(self):
        expected = {"PUSH", "PULL_REQUEST", "MANUAL", "SCHEDULE", "WEBHOOK", "TAG"}
        actual = {t.value for t in PipelineTrigger}
        assert actual == expected


class TestPipelineEngineConstants:
    """Validate engine templates and helper generators."""

    def test_rand_sha_generation(self):
        sha = _rand_sha()
        assert len(sha) == 40
        assert all(c in "0123456789abcdef" for c in sha)

    def test_rand_short_sha_generation(self):
        short_sha = _rand_short_sha()
        assert len(short_sha) == 7
        assert all(c in "0123456789abcdef" for c in short_sha)

    def test_default_stages_structure(self):
        assert len(DEFAULT_STAGES) == 10
        expected_types = [
            "SOURCE", "INSTALL", "SECURITY_SCAN", "BUILD", "TEST",
            "LINT", "DOCKER_BUILD", "PUSH_REGISTRY", "DEPLOY", "NOTIFY",
        ]
        actual_types = [s["type"] for s in DEFAULT_STAGES]
        assert actual_types == expected_types

    def test_stage_templates_consistency(self):
        for stage in DEFAULT_STAGES:
            stype = stage["type"]
            assert stype in _STAGE_TEMPLATES
            tpl = _STAGE_TEMPLATES[stype]
            assert "logs_pass" in tpl
            assert "duration_range" in tpl
            assert "fail_rate" in tpl
            assert stype in _FAIL_LOGS


class TestPipelineSchemas:
    """Validate Pydantic request and response schemas."""

    def test_pipeline_create_request_valid(self):
        req = PipelineCreateRequest(
            name="Prod Delivery",
            repo_url="https://github.com/org/repo",
            branch="main",
            trigger="PUSH",
            auto_deploy=True,
            deploy_target="kubernetes",
        )
        assert req.name == "Prod Delivery"
        assert req.branch == "main"
        assert req.auto_deploy is True

    def test_pipeline_create_request_validation_error(self):
        with pytest.raises(ValidationError):
            PipelineCreateRequest(name="")

    def test_trigger_run_request(self):
        req = TriggerRunRequest(
            commit_sha="abcdef1234567890",
            commit_message="fix: bug",
            commit_author="Dev",
            branch="release",
        )
        assert req.commit_sha == "abcdef1234567890"
        assert req.branch == "release"

    def test_stage_out_schema(self):
        stage = StageOut(
            id=1,
            name="Compile",
            stage_type="BUILD",
            order=0,
            status="SUCCESS",
            logs="ok",
            exit_code=0,
            duration_ms=5000,
        )
        assert stage.id == 1
        assert stage.status == "SUCCESS"

    def test_run_out_schema(self):
        run = RunOut(
            id=1,
            run_number=1,
            status="SUCCESS",
            trigger="PUSH",
            branch="main",
            stages=[],
        )
        assert run.run_number == 1
        assert run.status == "SUCCESS"

    def test_pipeline_out_schema(self):
        pipe = PipelineOut(
            id=10,
            name="Core CI",
            branch="main",
            trigger="PUSH",
            is_active=True,
            auto_deploy=True,
            deploy_target="kubernetes",
            runs=[],
        )
        assert pipe.id == 10
        assert pipe.is_active is True
