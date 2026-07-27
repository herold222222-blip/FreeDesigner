import { SPECIALTIES, resolveTrackLabels } from "@/lib/constants";
import type { Designer, ReviewItem, SubjectType } from "@/lib/types";

const SUBJECT_LABEL: Record<SubjectType, string> = {
  individual: "个人设计师",
  team: "设计团队",
  company: "设计公司",
};

function maskPhoneForReview(phone?: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return phone?.trim() || "—";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function formatProfession(designer: Designer) {
  if (designer.primaryTrack) {
    const { l1Label, l2Label, l3Label } = resolveTrackLabels(
      designer.primaryTrack.l1,
      designer.primaryTrack.l2,
      designer.primaryTrack.l3,
    );
    return `${l1Label} · ${l2Label} / ${l3Label}`;
  }
  return (
    SPECIALTIES.find((s) => s.value === designer.specialty)?.label ??
    designer.specialty
  );
}

/** 构建设计师入驻审核工单 */
export function buildDesignerOnboardingReviewItem(
  designer: Designer,
  phone?: string,
): ReviewItem {
  const subjectType = designer.subjectType ?? "individual";
  return {
    id: `rv_designer_${designer.id}`,
    type: "designer",
    name: designer.name,
    submittedAt: new Date().toISOString(),
    status: "pending",
    refId: designer.id,
    payload: {
      主体类型: SUBJECT_LABEL[subjectType],
      手机号: maskPhoneForReview(phone ?? designer.phone),
      所在地: designer.location?.trim() || "—",
      专业: formatProfession(designer),
      工作年限: `${designer.yearsOfExperience ?? 0} 年`,
      编号: designer.code || "—",
    },
  };
}
