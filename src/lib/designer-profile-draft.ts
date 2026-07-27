import type {
  Designer,
  EducationExperience,
  EmploymentExperience,
  HighestEducation,
  OnlineMeetingTimeOption,
  ServiceMode,
  Specialty,
  SubSpecialty,
  TravelDurationOption,
} from "@/lib/types";
import { inferRegionTier } from "@/lib/constants";
import {
  emptyEducationExperience,
  emptyEmploymentExperience,
  highestEducationLabel,
  normalizeEducationExperiences,
  normalizeEmploymentExperiences,
} from "@/lib/designer-education";
import { getOnlineMeetingTimeLabel } from "@/lib/designer-service-settings";
import { defaultPrimaryTrackForSpecialty } from "@/lib/designer-track-resolve";

/** 入驻后可在主页编辑的字段（不含姓名、年龄 / 从业年限） */
export interface DesignerProfileDraft {
  phone?: string;
  location?: string;
  /** @deprecated 请用 highestEducation + educationExperiences */
  education?: string;
  /** @deprecated 请用 employmentExperiences */
  formerEmployers?: string[];
  highestEducation?: HighestEducation;
  educationExperiences?: EducationExperience[];
  employmentExperiences?: EmploymentExperience[];
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

export function deriveProjectTypeTagsFromPortfolio(designer: Designer): string[] {
  const fromPortfolio = [
    ...new Set(designer.portfolio.map((p) => p.category).filter(Boolean)),
  ];
  return fromPortfolio.length > 0 ? fromPortfolio : designer.projectTypeTags;
}

export function designerDraftFromDesigner(designer: Designer): DesignerProfileDraft {
  const educationExperiences = normalizeEducationExperiences(
    designer.educationExperiences,
  );
  const employmentExperiences = normalizeEmploymentExperiences(
    designer.employmentExperiences,
  );
  return {
    phone: "",
    location: designer.location,
    highestEducation: designer.highestEducation,
    educationExperiences:
      educationExperiences.length > 0
        ? educationExperiences
        : [emptyEducationExperience()],
    employmentExperiences:
      employmentExperiences.length > 0
        ? employmentExperiences
        : [emptyEmploymentExperience()],
    education:
      designer.education ??
      (designer.highestEducation
        ? highestEducationLabel(designer.highestEducation)
        : ""),
    formerEmployers:
      designer.formerEmployers ??
      (employmentExperiences.length
        ? employmentExperiences
            .map((e) => e.company)
            .filter((x): x is string => Boolean(x))
        : []),
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

  const nextSpecialty = draft.specialty ?? base.specialty;
  const nextSubs = draft.subSpecialties ?? base.subSpecialties;
  const specialtyChanged =
    draft.specialty !== undefined && draft.specialty !== base.specialty;
  const subsChanged = draft.subSpecialties !== undefined;
  const trackMismatch =
    !base.primaryTrack || base.primaryTrack.l1 !== nextSpecialty;
  /** 专业变更、航道缺失/不一致，或子专业变更时，同步 primaryTrack */
  const shouldSyncTrack = specialtyChanged || trackMismatch || subsChanged;

  const nextLocation =
    draft.location !== undefined ? draft.location : base.location;
  const merged: Designer = {
    ...base,
    ...(draft.location !== undefined
      ? {
          location: draft.location,
          regionTier: draft.location.trim()
            ? inferRegionTier(draft.location)
            : base.regionTier,
        }
      : !base.regionTier && nextLocation?.trim()
        ? { regionTier: inferRegionTier(nextLocation) }
        : {}),
    ...(draft.highestEducation !== undefined
      ? {
          highestEducation: draft.highestEducation,
          education: highestEducationLabel(draft.highestEducation),
        }
      : draft.education !== undefined
        ? { education: draft.education }
        : {}),
    ...(draft.educationExperiences !== undefined
      ? {
          educationExperiences: normalizeEducationExperiences(
            draft.educationExperiences,
          ),
        }
      : {}),
    ...(draft.employmentExperiences !== undefined
      ? {
          employmentExperiences: normalizeEmploymentExperiences(
            draft.employmentExperiences,
          ),
          formerEmployers: normalizeEmploymentExperiences(
            draft.employmentExperiences,
          )
            .map((e) => e.company)
            .filter((x): x is string => Boolean(x)),
        }
      : draft.formerEmployers !== undefined
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
    ...(shouldSyncTrack
      ? {
          primaryTrack: defaultPrimaryTrackForSpecialty(nextSpecialty, nextSubs),
          ...(specialtyChanged ? { secondaryTracks: [] } : {}),
        }
      : {}),
  };

  return {
    ...merged,
    projectTypeTags: deriveProjectTypeTagsFromPortfolio(merged),
  };
}
