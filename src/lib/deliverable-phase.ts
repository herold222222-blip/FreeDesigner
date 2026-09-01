import type { DeliverableFile, Order, PaymentStage } from "@/lib/types";

export type DeliverableKind = "preliminary" | "final" | "revision";
export type DeliverablePhase = "preliminary" | "final" | "done";

export function resolveDeliverableKind(
  file: Pick<DeliverableFile, "kind">,
): DeliverableKind {
  return file.kind ?? "final";
}

export function filesOfKind(
  stage: Pick<PaymentStage, "deliverables">,
  kind: DeliverableKind,
): DeliverableFile[] {
  return (stage.deliverables ?? []).filter(
    (file) => resolveDeliverableKind(file) === kind,
  );
}

export function hasPreliminaryGate(stage: Pick<PaymentStage, "preliminaryConfirmedAt" | "preliminarySkippedAt">) {
  return Boolean(stage.preliminaryConfirmedAt || stage.preliminarySkippedAt);
}

/** 当前应处理的成果步骤：初步 → 最终 → 已完成最终确认 */
export function resolveDeliverablePhase(
  stage: PaymentStage,
  orderStatus?: Order["status"],
): DeliverablePhase {
  if (stage.deliverablesConfirmedAt && orderStatus !== "in_revision") {
    return "done";
  }
  if (hasPreliminaryGate(stage)) return "final";
  const hasKindedPrelim = filesOfKind(stage, "preliminary").length > 0;
  const hasKindedFinal =
    filesOfKind(stage, "final").length > 0 ||
    filesOfKind(stage, "revision").length > 0;
  if (hasKindedFinal && !hasKindedPrelim) return "final";
  if (hasKindedPrelim) return "preliminary";
  const untagged = (stage.deliverables ?? []).filter((file) => !file.kind);
  if (untagged.length > 0) return "final";
  return "preliminary";
}

export function uploadKindForPhase(
  stage: PaymentStage,
  orderStatus?: Order["status"],
): DeliverableKind {
  if (orderStatus === "in_revision") return "revision";
  return resolveDeliverablePhase(stage, orderStatus) === "final"
    ? "final"
    : "preliminary";
}

export function clientConfirmLabel(phase: DeliverablePhase): string {
  if (phase === "preliminary") return "初步成果确认";
  if (phase === "final") return "最终成果确认";
  return "已确认成果";
}

export function designerUploadLabel(
  phase: DeliverablePhase,
  options?: { revising?: boolean; appending?: boolean },
): string {
  if (options?.revising) return "上传返修成果";
  if (phase === "final") {
    return options?.appending ? "继续上传最终成果" : "上传最终成果 / 确认单";
  }
  return options?.appending ? "继续上传初步成果" : "上传初步成果";
}

export function designerUploadHint(phase: DeliverablePhase, revising?: boolean): string {
  if (revising) return "请按返修意见上传修改后的成果，可上传图片、PDF、CAD 或压缩包。";
  if (phase === "final") {
    return "请上传最终的 PDF + CAD 完整成果（也可含压缩包）。委托人确认后开始尾款时限。";
  }
  return "图纸一般先发 PDF 给委托人确认，确认或跳过后再上传最终的 PDF + CAD 完整成果。";
}

export function canSkipPreliminary(
  stage: PaymentStage,
  orderStatus?: Order["status"],
): boolean {
  if (orderStatus === "in_revision") return false;
  if (stage.deliverablesConfirmedAt) return false;
  return resolveDeliverablePhase(stage, orderStatus) === "preliminary";
}

export function canClientConfirmPhase(
  stage: PaymentStage,
  orderStatus?: Order["status"],
): boolean {
  const phase = resolveDeliverablePhase(stage, orderStatus);
  if (phase === "preliminary") {
    return (
      filesOfKind(stage, "preliminary").length > 0 ||
      filesOfKind(stage, "revision").length > 0
    );
  }
  if (phase === "final") {
    return (
      filesOfKind(stage, "final").length > 0 ||
      filesOfKind(stage, "revision").length > 0 ||
      (stage.deliverables ?? []).some((file) => !file.kind)
    );
  }
  return false;
}

export function groupedDeliverables(stage: Pick<PaymentStage, "deliverables">) {
  const files = [...(stage.deliverables ?? [])].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  return {
    preliminary: files.filter((file) => resolveDeliverableKind(file) === "preliminary"),
    final: files.filter((file) => resolveDeliverableKind(file) === "final"),
    revision: files.filter((file) => resolveDeliverableKind(file) === "revision"),
  };
}
