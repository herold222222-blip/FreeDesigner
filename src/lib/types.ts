export type Role = "guest" | "client" | "designer" | "admin" | "super_admin";

/** 管理员后台 · 设计师列表行（含账号与订单统计） */
export interface AdminDesignerRow extends Designer {
  phone?: string;
  userId?: string;
  accountStatus?: "active" | "disabled";
  ongoingOrdersCount?: number;
  /** 入驻 / 注册时间（管理员列表展示） */
  registeredAt?: string;
}

/** 管理员后台 · 委托人列表行（含账号与订单 / 支付统计） */
export interface AdminClientRow extends Client {
  phone?: string;
  userId?: string;
  accountStatus?: "active" | "disabled";
  ongoingOrdersCount?: number;
  /** 累计支付金额（钱包流水汇总） */
  totalPaidAmount?: number;
  /** 注册时间（管理员列表展示） */
  registeredAt?: string;
}

/** 平台管理员账号（超级管理员后台管理） */
export interface PlatformAdminAccount {
  id: string;
  loginName: string;
  name: string;
  phone: string;
  status: "active" | "disabled";
  createdAt: string;
}

export type Specialty =
  | "architecture"
  | "landscape"
  | "interior"
  | "rendering"
  | "cost_consulting";

// 兼容旧字段：原 SubSpecialty 现作为 LegacySubSpecialty 保留
export type SubSpecialty =
  | "garden_construction"
  | "greening"
  | "drainage"
  | "electrical"
  | "concept"
  | "construction_doc"
  | "model"
  | "soft_decoration";

// 设计主体类型
export type SubjectType = "individual" | "team" | "company";

/** 设计公司资质项（设计领域 · 资质类别 · 级别） */
export interface CompanyQualification {
  fieldId: string;
  fieldLabel: string;
  categoryId: string;
  categoryLabel: string;
  levelId: string;
  levelLabel: string;
}

// 设计师等级（v1.1 新增）
export type DesignerLevel =
  | "intern" // 见习设计师 85%
  | "mid_v1" // 中级 v1 100%
  | "senior_v1" // 高级 v1 130%
  | "specialist"; // 特级（默认 150%，可自定义）

// 客户等级（v1.1 新增）
export type ClientLevel =
  | "strategic" // 战略客户 90%
  | "premium" // 优质客户 95%
  | "normal" // 普通客户 100%
  | "secondary" // 次级客户 110%
  | "graylist"; // 灰名单

// 地区梯队（v1.1 新增）
export type RegionTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5" | "tier6";

// 评价维度（v1.1 新增）
export interface RatingBreakdown {
  professional: number; // 专业能力 1-5
  service: number; // 服务态度 1-5
  responsiveness: number; // 响应速度 1-5
}

// 印象 / 标签（v1.1 新增）
export interface ImpressionTag {
  id: string;
  label: string;
  count: number; // 累计被点击 +1 次数
}

/** 项目验收后委托人对设计师的历史评价 */
export interface DesignerProjectReview {
  id: string;
  designerId: string;
  orderCode: string;
  projectTitle: string;
  projectType: string;
  clientDisplayName: string;
  completedAt: string;
  overall: number;
  breakdown: RatingBreakdown;
  content: string;
  impressionTags?: string[];
}

export type OnlineStatus = "online" | "offline";
export type WorkloadStatus = "free" | "normal" | "busy";
export type ActivityIndicator = "green" | "yellow" | "red";

export type ServiceMode = "online" | "onsite";

export type OnlineMeetingTimeOption =
  | "anytime"
  | "work_hours"
  | "off_hours"
  | "advance_notice";

export type TravelDurationOption = "short" | "long";
export type BillingMode = "daily" | "monthly" | "area";

/** 团队 / 公司人数区间（独立设计师不适用） */
export type TeamSizeOption =
  | "1-10"
  | "11-20"
  | "21-50"
  | "51-100"
  | "101-200"
  | "200+";

/** 订单来源 / 委托方式 */
export type OrderSource =
  | "directed"
  | "regular"
  | "bounty"
  | "scan";

export interface PortfolioItem {
  id: string;
  category: string;
  title: string;
  cover: string;
  year: number;
}

/** 半天时段：上午 / 下午 */
export type DayPeriod = "am" | "pm";

/** 选中的半天档期 */
export interface HalfDaySlot {
  date: string;
  period: DayPeriod;
}

export interface CalendarSlot {
  date: string;
  /** 上午是否可预约 */
  amAvailable: boolean;
  /** 下午是否可预约 */
  pmAvailable: boolean;
  /** 当日是否有任意可预约时段（便于列表筛选） */
  available: boolean;
}

/** 工时半天的工作内容条目 */
export interface WorkContentItem {
  id: string;
  text: string;
}

/** 工作日历中的半天日程（占用档期） */
export interface WorkCalendarEvent {
  id: string;
  date: string;
  period: DayPeriod;
  title: string;
  source: "manual" | "order";
  orderCode?: string;
  note?: string;
  /** 设计师填写的工作内容（可多条） */
  workContents?: WorkContentItem[];
  /** 首次保存工作内容的时间，起算 24 小时可修改窗口 */
  workContentsSavedAt?: string;
}

/** 委托人提交的档期申请，待设计师确认 */
export interface ScheduleRequest {
  id: string;
  orderId: string;
  designerId: string;
  clientId: string;
  serviceMode: ServiceMode;
  billingMode: BillingMode;
  title: string;
  /** 按天计费时的半天档期 */
  slots: HalfDaySlot[];
  /** 按月雇佣时的月份，如 2026-05 */
  selectedMonths?: string[];
  address?: string;
  totalAmount: number;
  status: "pending" | "accepted" | "rejected";
  submittedAt: string;
  respondedAt?: string;
  rejectReason?: string;
}

export interface Designer {
  id: string;
  /** 平台对外编号，委托人发布委托时可填写 */
  code: string;
  /** 注册手机号（仅管理员后台接口返回，公开展示不包含） */
  phone?: string;
  name: string;
  avatar: string;
  /** 个人设计师性别（用于名称后展示符号） */
  gender?: "male" | "female";
  /** 主体类型：个人 / 团队 / 公司 */
  subjectType?: SubjectType;
  /** 团队 / 公司人数区间（仅 team / company 适用） */
  teamSize?: TeamSizeOption;
  /** 团队 / 公司创建年份 */
  foundedYear?: number;
  /** 统一社会信用代码（设计公司） */
  creditCode?: string;
  /** 营业范围（设计公司） */
  businessScope?: string;
  /** 设计公司是否申报无资质 */
  companyQualificationNone?: boolean;
  /** 设计公司资质（可多选） */
  companyQualifications?: CompanyQualification[];
  /** 团队 / 公司联系人姓名 */
  contactName?: string;
  /** 所在地范围：国内省市 / 国外国家 */
  locationScope?: "domestic" | "overseas";
  /** 国外所在地国家名 */
  overseasCountry?: string;
  specialty: Specialty;
  /** 主专业（一级 + 二级 + 三级），v1.1 三级专业体系 */
  primaryTrack?: { l1: Specialty; l2: string; l3: string };
  /** 副专业（最多 2 项，团队/公司无限制） */
  secondaryTracks?: { l1: Specialty; l2: string; l3: string }[];
  subSpecialties: SubSpecialty[];
  yearsOfExperience: number;
  location: string;
  /** 设计师所在地对应的地区梯队（影响系数） */
  regionTier?: RegionTier;
  onlineStatus: OnlineStatus;
  workloadStatus: WorkloadStatus;
  activityIndicator: ActivityIndicator;
  lastActiveAt: string;
  isOpenToTravel: boolean;
  supportsHandDrawing: boolean;
  isInJob: boolean;
  /** 接单开关（v1.1 新增） */
  acceptingOrders?: boolean;
  /** 学历 */
  education?: string;
  /** 曾任职公司 */
  formerEmployers?: string[];
  /** 接受出差时的时长偏好 */
  travelDuration?: TravelDurationOption | null;
  /** 是否接受背靠背合同 */
  acceptBackToBackContract?: boolean;
  /** 是否做过境外项目 */
  hasOverseasExperience?: boolean;
  overseasCountries?: string[];
  /** 是否接受按时间计费 */
  acceptTimeBilling?: boolean;
  /** 是否有现场服务经验 */
  hasOnsiteExperience?: boolean;
  onlineMeetingTime?: OnlineMeetingTimeOption;
  serviceModes: ServiceMode[];
  meetingFlexibility: string;
  /** 设计师等级（v1.1 新增） */
  level?: DesignerLevel;
  tagline: string;
  bio: string;
  expertiseTags: string[];
  projectTypeTags: string[];
  dailyRate: number;
  monthlyRate: number;
  /** 相对平台基数的自定义费率百分比（lineId -> 50–200） */
  ratePercents?: Record<string, number>;
  rating: number;
  /** 三维度评价（v1.1 新增） */
  ratingBreakdown?: RatingBreakdown;
  /** 印象 / 标签（v1.1 新增） */
  impressions?: ImpressionTag[];
  completedProjects: number;
  reviewCount: number;
  portfolio: PortfolioItem[];
  calendar: CalendarSlot[];
  /** 工作日历日程（占用半天） */
  workCalendarEvents?: WorkCalendarEvent[];
  /** 接单档期批量规则 */
  calendarBatchSettings?: {
    closeWeekend: boolean;
    closeHoliday: boolean;
    allDay: boolean;
  };
}

export interface Client {
  id: string;
  /** 平台对外编号，如 CL000001 */
  code?: string;
  name: string;
  avatar: string;
  type: "individual" | "enterprise";
  verified: boolean;
  companyName?: string;
  /** 企业联系人姓名 */
  contactName?: string;
  /** 注册手机号（仅管理员后台接口返回） */
  phone?: string;
  /** 常驻地区（省 · 市 · 区） */
  location?: string;
  /** 个人委托人性别（用于默认头像等） */
  gender?: "male" | "female";
  joinedAt: string;
  /** 客户等级（v1.1 新增） */
  level?: ClientLevel;
  /** 收藏的设计师 ID 列表（v1.1 新增） */
  favoriteDesignerIds?: string[];
  /** 上一自然年累计支付金额（用于战略客户判定） */
  yearlyPaidAmount?: number;
}

export type OrderStatus =
  | "matching"
  | "pending_schedule"
  | "pending_contract"
  | "in_progress"
  | "pending_review"
  | "in_revision"
  | "completed"
  | "terminated"
  | "cancelled";

export interface PaymentStage {
  id: string;
  name: string;
  amount: number;
  ratio: number;
  status: "pending" | "paid" | "frozen" | "released";
  paidAt?: string;
  releasedAt?: string;
  /** 成果确认截止（超时自动确认，默认付款后 10 天） */
  acceptanceDeadlineAt?: string;
  /** 委托人应付截止日（超时未付则计入监管「超时订单」） */
  dueAt?: string;
  deliverables?: DeliverableFile[];
  /** 更换设计师后，管理员更新的本阶段各设计师支付比例拆分 */
  designerPaymentSplits?: StageDesignerPaymentSplit[];
}

/** 某付款阶段内的费用拆分（设计师 / 审图师 / 项目管理员等） */
export interface StageDesignerPaymentSplit {
  /** 设计师 id（设计服务） */
  designerId?: string;
  /** 增值服务人员 id（审图师 / 项目管理员） */
  serviceProviderId?: string;
  /** 占订单总额的比例，如 0.2 = 20% */
  orderRatio: number;
  amount: number;
  label: string;
  trackAssignmentId?: string;
  /** 是否因更换设计师产生的拆分 */
  fromReplacement?: boolean;
  role?:
    | "previous"
    | "current"
    | "unchanged"
    | "collaborator"
    | "auditor"
    | "project_manager";
  /** 配合服务记录 id（role 为 collaborator 时） */
  collaboratorServiceId?: string;
  auditAssignmentId?: string;
  workDays?: number;
  dailyRate?: number;
}

export interface DeliverableFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  thumbnail?: string;
  locked: boolean;
  /** 上传该成果的设计师 */
  designerId?: string;
}

export interface RevisionRequest {
  id: string;
  stageId: string;
  description: string;
  attachments: { name: string }[];
  createdAt: string;
  status: "pending" | "responded";
}

export interface OrderMessage {
  id: string;
  authorId: string;
  authorRole: "client" | "designer" | "system";
  content: string;
  createdAt: string;
}

export interface Order {
  id: string;
  code: string;
  title: string;
  specialty: Specialty;
  subSpecialty?: SubSpecialty;
  projectType: string;
  designerId: string;
  clientId: string;
  status: OrderStatus;
  serviceMode: ServiceMode;
  billingMode: BillingMode;
  /** 下单来源：定向下单 / 常规委托 / 悬赏 / 扫码 */
  orderSource?: OrderSource;
  /** 常规委托按面积时的面积（㎡） */
  projectAreaSqm?: number;
  totalAmount: number;
  feeRate: number;
  createdAt: string;
  expectedDeliveryAt: string;
  contractId: string;
  stages: PaymentStage[];
  revisions: RevisionRequest[];
  messages: OrderMessage[];
  description: string;
  onsiteSchedule?: { from: string; to: string; address: string };
  /** 已确认的半天档期（定向下单 / 上门预约） */
  selectedSlots?: HalfDaySlot[];
  /** 按月雇佣的雇佣月份，如 2026-05 */
  selectedMonths?: string[];
  /** 关联的档期申请 id */
  scheduleRequestId?: string;
  /** 是否包含审图服务（v1.1 新增） */
  withAuditService?: boolean;
  /** 是否包含项目管理服务（v1.1 新增） */
  withProjectManagement?: boolean;
  /** 按一级-二级-三级专业分工的服务设计师（v1.1 多专业订单） */
  trackAssignments?: OrderTrackAssignment[];
  /** 历史更换设计师记录 */
  designerReplacements?: OrderDesignerReplacement[];
  /** 阶段内配合设计师服务（工时计费，需原设计师确认后生效） */
  stageCollaborators?: StageCollaboratorService[];
  /** 第三方审图：按三级专业配置的审图师 */
  auditAssignments?: OrderAuditAssignment[];
  /** 施工图项目管理员（整体施工图协调） */
  projectManagement?: OrderProjectManagement;
  /** 委托人是否已完成对设计师的项目评价 */
  clientReviewed?: boolean;
  /** 委托人已签署电子合同 */
  clientSignedContract?: boolean;
  /** 设计师已签署电子合同 */
  designerSignedContract?: boolean;
  /** 双方签约完成时间 */
  contractSignedAt?: string;
  /** 全部阶段验收后等待最终结案确认 */
  pendingSettlement?: boolean;
  /** 进入待结案状态的时间（全部阶段验收后） */
  pendingSettlementAt?: string;
  /** 设计师申请项目结算时间 */
  settlementRequestedAt?: string;
  /** 委托人确认最终服务完成时间 */
  settlementConfirmedAt?: string;
  /** 评价有效期截止（结案后 3 个月） */
  reviewDeadlineAt?: string;
  /** 评价期已结束且委托人未评价 */
  reviewExpired?: boolean;
  /** 关联悬赏 id（悬赏委托来源） */
  bountyId?: string;
}

/** 第三方审图师 · 对应某一三级专业 */
export interface OrderAuditAssignment {
  id: string;
  l1: Specialty;
  l2: string;
  l3: string;
  /** 关联的设计专业分工 id */
  trackAssignmentId: string;
  auditorId: string;
  status: "serving" | "completed" | "pending_match";
  stageId: string;
  /** 审图成果（审图意见书等） */
  deliverableIds?: string[];
}

/** 施工图项目管理员 · 针对整体施工图 */
export interface OrderProjectManagement {
  id: string;
  projectManagerId: string;
  status: "serving" | "completed" | "pending_match";
  /** 服务范围说明 */
  scope: string;
  stageId: string;
  deliverableIds?: string[];
}

export type StageCollaboratorStatus =
  | "in_progress"
  | "pending_confirm"
  | "confirmed"
  | "rejected";

/** 管理员登记的阶段配合设计师服务 */
export interface StageCollaboratorService {
  id: string;
  orderId: string;
  stageId: string;
  /** 本阶段原服务设计师（须确认配合费） */
  primaryDesignerId: string;
  trackAssignmentId?: string;
  collaboratorDesignerId: string;
  workDays: number;
  dailyRate: number;
  totalFee: number;
  status: StageCollaboratorStatus;
  description?: string;
  adminNote?: string;
  createdAt: string;
  submittedAt?: string;
  confirmedAt?: string;
  confirmedByDesignerId?: string;
  rejectedAt?: string;
  rejectReason?: string;
}

/** 订单内某一三级专业分支的当前服务设计师 */
export interface OrderTrackAssignment {
  id: string;
  l1: Specialty;
  l2: string;
  l3: string;
  designerId: string;
  /** 当前关联的付款阶段 */
  stageId: string;
  status: "serving" | "completed" | "pending_match";
  /** 该专业在当前阶段已上传的成果 id（对应 PaymentStage.deliverables） */
  deliverableIds?: string[];
}

/** 某三级专业分支的设计师更换记录 */
export interface OrderDesignerReplacement {
  id: string;
  l1: Specialty;
  l2: string;
  l3: string;
  /** 关联的分工条目 id（可选） */
  trackAssignmentId?: string;
  previousDesignerId: string;
  currentDesignerId: string;
  reason?: string;
  replacedAt: string;
  /** 更换发生时所在阶段名称 */
  stageName?: string;
  /** 关联付款阶段 id */
  stageId?: string;
  /** 原设计师在更换前已提交的成果 */
  previousDeliverables?: DeliverableFile[];
  /** 原设计师本专业服务起始时间 */
  previousServiceFrom: string;
  /** 原设计师本专业服务结束时间（更换生效） */
  previousServiceTo: string;
  /** 现任设计师本专业服务起始时间 */
  currentServiceFrom?: string;
  /** 管理员更新后的支付比例调整 */
  paymentAdjustment?: OrderDesignerReplacementPaymentAdjust;
}

/** 更换设计师后，管理员对某阶段支付比例的重新分配 */
export interface OrderDesignerReplacementPaymentAdjust {
  stageId: string;
  /** 本阶段原合同占比（占订单总额） */
  originalOrderRatio: number;
  /** 更换前该专业分支占订单总额的比例（如 0.4 = 40%） */
  previousSingleOrderRatio: number;
  splits: StageDesignerPaymentSplit[];
  adjustedAt: string;
  adminNote: string;
}

export interface BountyApplicant {
  designerId: string;
  /** 报名时选择承接的三级专业 */
  appliedL3: string;
  proposal: string;
  quotedAmount: number;
  estimatedDays: number;
  appliedAt: string;
}

/** 建筑 / 景观 / 室内悬赏的设计阶段 */
export type BountyDesignScope = "scheme" | "construction_doc" | "full_process";

export interface BountyTrack {
  l1: Specialty;
  /** 二级专业（可多选） */
  l2: string[];
  /** 三级专业（可多选） */
  l3: string[];
}

export interface BountyLocation {
  provinceCode: string;
  provinceName: string;
  cityCode?: string;
  cityName?: string;
  /** 展示标签，如「江苏省 · 苏州市」或「陕西省」 */
  label: string;
}

export interface Bounty {
  id: string;
  code: string;
  title: string;
  specialty: Specialty;
  /** 一级专业 + 二/三级专业（后两者可多选） */
  primaryTrack: BountyTrack;
  /** @deprecated 已废弃，保留兼容旧数据 */
  designScope?: BountyDesignScope;
  projectType?: string;
  location: BountyLocation;
  description: string;
  reward: number;
  rewardModel: "fixed" | "negotiable";
  /** 成果提交截止时间 */
  deadline: string;
  publishedAt: string;
  publisherId: string;
  status: "open" | "paused" | "in_review" | "awarded" | "completed" | "closed";
  attachments: { name: string }[];
  requirements: string[];
  applicants: BountyApplicant[];
  /** 公开场景隐藏报名明细时保留的报名人数 */
  applicantCount?: number;
  /** 委托人倾向的设计师编号（选填，可多个） */
  preferredDesignerCodes?: string[];
  /** 可接单设计主体筛选（选填） */
  subjectFilters?: BountySubjectFilters;
  /** 中标设计师 id */
  awardedDesignerId?: string;
  /** 中标后生成的平台订单 id */
  orderId?: string;
}

/** 悬赏委托 · 设计主体筛选条件 */
export interface BountySubjectFilters {
  /** 团队规模，空数组表示不限 */
  subjectTypes?: SubjectType[];
  /** 最低设计主体等级，undefined 表示不限 */
  minDesignerLevel?: DesignerLevel;
  /** 地域要求，空数组表示不限 */
  regionRequirements?: BountyRegionRequirement[];
  /** 最低评分，undefined 表示不限 */
  minRating?: number;
}

export interface BountyRegionRequirement {
  type: "province" | "city";
  code: string;
  label: string;
}

export interface WalletTransaction {
  id: string;
  orderId?: string;
  orderCode?: string;
  orderTitle?: string;
  /** 关联付款阶段（预付款 / 阶段款 / 按月按天服务费等） */
  stageId?: string;
  type: "income" | "withdraw" | "fee" | "refund";
  amount: number;
  status: "frozen" | "available" | "withdrawn";
  occurredAt: string;
  releasedAt?: string;
  note: string;
  /** 已开具发票 id */
  invoiceId?: string;
  /** 已开具发票号码（列表展示用） */
  invoiceNo?: string;
}

export type InvoiceType = "ordinary" | "special";

export interface InvoiceRequest {
  id: string;
  /** 电子发票号码 */
  invoiceNo: string;
  clientId: string;
  walletTransactionId: string;
  orderId?: string;
  orderCode?: string;
  orderTitle?: string;
  /** 开票金额（正数，元） */
  amount: number;
  /** 发票抬头 */
  title: string;
  /** 纳税人识别号 / 统一社会信用代码 */
  taxId: string;
  invoiceType: InvoiceType;
  /** 接收邮箱 */
  email: string;
  phone?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  remark?: string;
  /** 对应付款记录说明 */
  paymentNote: string;
  status: "issued";
  issuedAt: string;
}

export interface CreateInvoiceInput {
  walletTransactionId: string;
  title: string;
  taxId: string;
  invoiceType: InvoiceType;
  email: string;
  phone?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  remark?: string;
}

export type DisputeStatus = "open" | "in_review" | "resolved";
export type DisputeRaisedBy = "client" | "designer";
export type DisputeResolution = "client" | "designer" | "split";

/** 订单纠纷（平台介入裁决） */
export interface Dispute {
  id: string;
  orderId: string;
  orderCode: string;
  title: string;
  clientId: string;
  designerId: string;
  /** 争议涉及金额（通常对应某付款阶段托管金额） */
  amount: number;
  /** 关联付款阶段 */
  stageId?: string;
  raisedBy: DisputeRaisedBy;
  raisedById: string;
  type: string;
  description: string;
  raisedAt: string;
  status: DisputeStatus;
  evidence: { name: string }[];
  resolution?: DisputeResolution;
  /** 部分裁决时委托人承担比例（0–100） */
  clientSharePercent?: number;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
}

export interface ReviewItem {
  id: string;
  /** designer/enterprise=入驻审核；designer_promotion=见习晋级；designer_level_promotion=等级晋级 */
  type:
    | "designer"
    | "enterprise"
    | "designer_promotion"
    | "designer_level_promotion";
  name: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  payload: Record<string, string>;
  /** 关联实体 id（如待晋升设计师 id） */
  refId?: string;
}

/** 联系客服 · 在线留言 */
export interface FeedbackMessage {
  id: string;
  audience: "client" | "designer";
  userId?: string;
  identityId?: string;
  userName: string;
  phone?: string;
  message: string;
  status: "pending" | "replied" | "closed";
  createdAt: string;
  repliedAt?: string;
  replyNote?: string;
}
