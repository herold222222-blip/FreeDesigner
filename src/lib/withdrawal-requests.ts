/** 设计主体类型（提现申请人） */
export type DesignSubjectType = "individual" | "team" | "company";

export type WithdrawalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid";

/** 提现申请中包含的可提现款项明细（项目 + 阶段） */
export interface WithdrawalFeeItem {
  orderId: string;
  orderCode: string;
  orderTitle: string;
  stageId: string;
  stageName: string;
  amount: number;
  /** 该阶段验收解冻时间 */
  releasedAt?: string;
}

export interface WithdrawalRequest {
  id: string;
  designerId: string;
  designerName: string;
  designerCode: string;
  subjectType: DesignSubjectType;
  levelLabel: string;
  amount: number;
  availableBefore: number;
  bankName: string;
  accountTail: string;
  accountHolder: string;
  submittedAt: string;
  status: WithdrawalRequestStatus;
  rejectReason?: string;
  processedAt?: string;
  note?: string;
  /** 本次提现对应的可提现款项明细 */
  feeItems?: WithdrawalFeeItem[];
}

export const DESIGN_SUBJECT_TYPE_LABELS: Record<DesignSubjectType, string> = {
  individual: "个人设计师",
  team: "设计团队",
  company: "设计公司",
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalRequestStatus, string> =
  {
    pending: "待审批",
    approved: "已通过",
    rejected: "已驳回",
    paid: "已打款",
  };
