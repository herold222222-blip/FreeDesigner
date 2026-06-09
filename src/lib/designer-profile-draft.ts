import type {
  Designer,
  OnlineMeetingTimeOption,
  ServiceMode,
  Specialty,
  SubSpecialty,
  TravelDurationOption,
} from "@/lib/types";
import { getOnlineMeetingTimeLabel } from "@/lib/designer-service-settings";

/** 入驻后可在主页编辑的字段（不含姓名、年龄 / 从业年限） */
export interface DesignerProfileDraft {
  phone?: string;
  location?: string;
  education?: string;
  formerEmployers?: string[];
  avatar?: string;
  specialty?: Specialty;
  subSpecialties?: SubSpecialty[];
  tagline?: string;
  bio?: string;
  expertiseTags?: string[];
  /** 是否在职 */
  isInJob?: boolean;
  /** 是否接受改图服务 */
  acceptRevisionService?: boolean;
  /** 是否接受出差 */
  acceptTravel?: boolean;
  travelDuration?: TravelDurationOption | null;
  acceptBackToBackContract?: boolean;
  hasOverseasExperience?: boolean;
  overseasCountries?: string[];
  acceptTimeBilling?: boolean;
  hasOnsiteExperience?: boolean;
  onlineMeetingTime?: OnlineMeetingTimeOption;
  serviceModes?: ServiceMode[];
  dailyRate?: number;
  monthlyRate?: number;
  closeWeekend?: boolean;
  closeHoliday?: boolean;
  allYearOpen?: boolean;
}

/** 演示：注册时从身份证解析的固定年龄 */
export const DESIGNER_ID_CARD_AGE: Record<string, number> = {
  designer_chen: 38,
  designer_zhao: 35,
  designer_li: 42,
  designer_wang: 33,
  designer_he: 40,
};

export const DEFAULT_DESIGNER_PHONES: Record<string, string> = {
  designer_chen: "13912348821",
};

const DEFAULT_EDUCATION: Record<string, string> = {
  designer_chen: "同济大学 · 风景园林 · 硕士",
};

const DEFAULT_FORMER_EMPLOYERS: Record<string, string[]> = {
  designer_chen: ["AECOM 景观", "奥雅设计"],
};

export function deriveProjectTypeTagsFromPortfolio(designer: Designer): string[] {
  const fromPortfolio = [
    ...new Set(designer.portfolio.map((p) => p.category).filter(Boolean)),
  ];
  return fromPortfolio.length > 0 ? fromPortfolio : designer.projectTypeTags;
}

export function designerDraftFromDesigner(designer: Designer): DesignerProfileDraft {
  return {
    phone: DEFAULT_DESIGNER_PHONES[designer.id] ?? "",
    location: designer.location,
    education: designer.education ?? DEFAULT_EDUCATION[designer.id] ?? "",
    formerEmployers:
      designer.formerEmployers ?? DEFAULT_FORMER_EMPLOYERS[designer.id] ?? [],
    avatar: designer.avatar,
    specialty: designer.specialty,
    subSpecialties: [...designer.subSpecialties],
    tagline: designer.tagline,
    bio: designer.bio,
    expertiseTags: [...designer.expertiseTags],
    isInJob: designer.isInJob,
    acceptRevisionService: designer.supportsHandDrawing,
    acceptTravel: designer.isOpenToTravel,
    travelDuration: designer.travelDuration ?? (designer.isOpenToTravel ? "short" : null),
    acceptBackToBackContract: designer.acceptBackToBackContract ?? false,
    hasOverseasExperience: designer.hasOverseasExperience ?? false,
    overseasCountries: designer.overseasCountries ?? [],
    acceptTimeBilling: designer.acceptTimeBilling ?? true,
    hasOnsiteExperience: designer.hasOnsiteExperience ?? designer.serviceModes.includes("onsite"),
    onlineMeetingTime: designer.onlineMeetingTime ?? "work_hours",
    serviceModes: [...designer.serviceModes],
    dailyRate: designer.dailyRate,
    monthlyRate: designer.monthlyRate,
    closeWeekend: true,
    closeHoliday: true,
    allYearOpen: false,
  };
}

export function mergeDesignerProfile(
  base: Designer,
  draft?: DesignerProfileDraft | null,
): Designer {
  if (!draft) {
    return {
      ...base,
      projectTypeTags: deriveProjectTypeTagsFromPortfolio(base),
    };
  }

  const acceptTravel = draft.acceptTravel ?? base.isOpenToTravel;
  const acceptRevision = draft.acceptRevisionService ?? base.supportsHandDrawing;
  const meetingLabel = draft.onlineMeetingTime
    ? getOnlineMeetingTimeLabel(draft.onlineMeetingTime)
    : base.meetingFlexibility;

  const merged: Designer = {
    ...base,
    ...(draft.location !== undefined ? { location: draft.location } : {}),
    ...(draft.education !== undefined ? { education: draft.education } : {}),
    ...(draft.formerEmployers !== undefined
      ? { formerEmployers: draft.formerEmployers }
      : {}),
    ...(draft.specialty !== undefined ? { specialty: draft.specialty } : {}),
    ...(draft.subSpecialties !== undefined
      ? { subSpecialties: draft.subSpecialties }
      : {}),
    ...(draft.tagline !== undefined ? { tagline: draft.tagline } : {}),
    ...(draft.bio !== undefined ? { bio: draft.bio } : {}),
    ...(draft.expertiseTags !== undefined
      ? { expertiseTags: draft.expertiseTags }
      : {}),
    ...(draft.avatar !== undefined ? { avatar: draft.avatar } : {}),
    ...(draft.isInJob !== undefined ? { isInJob: draft.isInJob } : {}),
    isOpenToTravel: acceptTravel,
    supportsHandDrawing: acceptRevision,
    ...(draft.travelDuration !== undefined
      ? { travelDuration: acceptTravel ? draft.travelDuration : null }
      : {}),
    ...(draft.acceptBackToBackContract !== undefined
      ? { acceptBackToBackContract: draft.acceptBackToBackContract }
      : {}),
    ...(draft.hasOverseasExperience !== undefined
      ? { hasOverseasExperience: draft.hasOverseasExperience }
      : {}),
    ...(draft.overseasCountries !== undefined
      ? {
          overseasCountries: draft.hasOverseasExperience
            ? draft.overseasCountries
            : [],
        }
      : {}),
    ...(draft.acceptTimeBilling !== undefined
      ? { acceptTimeBilling: draft.acceptTimeBilling }
      : {}),
    ...(draft.hasOnsiteExperience !== undefined
      ? { hasOnsiteExperience: draft.hasOnsiteExperience }
      : {}),
    ...(draft.onlineMeetingTime !== undefined
      ? { onlineMeetingTime: draft.onlineMeetingTime }
      : {}),
    meetingFlexibility: meetingLabel,
    ...(draft.serviceModes !== undefined ? { serviceModes: draft.serviceModes } : {}),
    ...(draft.dailyRate !== undefined ? { dailyRate: draft.dailyRate } : {}),
    ...(draft.monthlyRate !== undefined ? { monthlyRate: draft.monthlyRate } : {}),
  };

  return {
    ...merged,
    projectTypeTags: deriveProjectTypeTagsFromPortfolio(merged),
  };
}
