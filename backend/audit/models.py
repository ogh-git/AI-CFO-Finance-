from typing import Optional
from pydantic import BaseModel


class CreateEngagementReq(BaseModel):
    type: str  # 'internal' | 'external'
    title: str
    period_from: str
    period_to: str
    lead_auditor: str
    dbs: list[str]


class UpdateEngagementReq(BaseModel):
    status: Optional[str] = None
    lead_auditor: Optional[str] = None


class CreatePBCItemReq(BaseModel):
    ref: str
    description: str
    owner: str
    due_date: str


class UpdatePBCStatusReq(BaseModel):
    status: str
    comment: Optional[str] = None


class BulkImportPBCReq(BaseModel):
    engagement_id: int
    items: list[dict]


class CreateFindingReq(BaseModel):
    severity: str  # critical | high | medium | low
    title: str
    description: str
    recommendation: str
    owner: str
    due_date: str


class UpdateFindingReq(BaseModel):
    status: Optional[str] = None
    management_response: Optional[str] = None
    retest_date: Optional[str] = None
    root_cause: Optional[str] = None


class SamplingRunReq(BaseModel):
    engagement_id: int
    db: str
    method: str  # random | stratified | mus | judgmental
    population_filter: dict = {}
    target_size: int = 25
    seed: int = 42
    confidence: float = 0.95
    tolerable_misstatement: float = 0.05
    judgmental_ids: list[int] = []
    company_ids: Optional[list[int]] = None


class TBLockReq(BaseModel):
    db: str
    period: str  # "YYYY-MM"
    company_ids: Optional[list[int]] = None


class RiskRegisterUpdateReq(BaseModel):
    likelihood: Optional[int] = None
    impact: Optional[int] = None
    control: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None


class SoDStatusReq(BaseModel):
    status: str


class AuditPackageReq(BaseModel):
    engagement_id: int
    include_tb: bool = True
    include_samples: bool = True
    include_findings: bool = True
    include_pbc: bool = True
