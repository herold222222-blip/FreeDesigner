/** 悬赏报名有效期：null / 缺省 = 不限；有值 = 整点 ISO 时间 */

export type BountyValidUntilDraft = {
  mode: "unlimited" | "until";
  date: string;
  hour: string;
};

export const BOUNTY_VALID_UNTIL_HOURS = Array.from({ length: 24 }, (_, h) => h);

export function emptyBountyValidUntilDraft(): BountyValidUntilDraft {
  return { mode: "unlimited", date: "", hour: "" };
}

export function draftFromValidUntil(
  validUntil?: string | null,
): BountyValidUntilDraft {
  if (!validUntil) return emptyBountyValidUntilDraft();
  const parts = toValidUntilLocalParts(validUntil);
  if (!parts) return emptyBountyValidUntilDraft();
  return { mode: "until", date: parts.date, hour: String(parts.hour) };
}

export function isValidUntilDraftComplete(draft: BountyValidUntilDraft): boolean {
  if (draft.mode === "unlimited") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return false;
  const hour = Number(draft.hour);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

export function validUntilFromDraft(
  draft: BountyValidUntilDraft,
): string | null {
  if (draft.mode === "unlimited") return null;
  const hour = Number(draft.hour);
  return fromValidUntilLocalParts(draft.date, hour);
}

export function fromValidUntilLocalParts(
  date: string,
  hour: number,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const local = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function toValidUntilLocalParts(
  iso: string,
): { date: string; hour: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, hour: date.getHours() };
}

export function parseHourPrecisionToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return fromValidUntilLocalParts(trimmed, 0);
  }
  const localMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2})(?::\d{2})?(?::\d{2})?(?:\.\d+)?$/,
  );
  if (localMatch) {
    return fromValidUntilLocalParts(localMatch[1], Number(localMatch[2]));
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function normalizeBountyValidUntil(
  input: unknown,
  options?: { requireFuture?: boolean },
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (
    input == null ||
    input === "" ||
    input === "unlimited" ||
    input === "不限"
  ) {
    return { ok: true, value: null };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "悬赏有效期格式无效" };
  }
  const iso = parseHourPrecisionToIso(input);
  if (!iso) {
    return {
      ok: false,
      error: "悬赏有效期须精确到整点，例如 2026年9月1日15点",
    };
  }
  if (options?.requireFuture && new Date(iso).getTime() <= Date.now()) {
    return { ok: false, error: "指定有效期须晚于当前时间" };
  }
  return { ok: true, value: iso };
}

export function isBountyValidityExpired(validUntil?: string | null): boolean {
  if (!validUntil) return false;
  const time = new Date(validUntil).getTime();
  if (Number.isNaN(time)) return false;
  return time <= Date.now();
}

export function isBountyOpenForApply(bounty: {
  status: string;
  validUntil?: string | null;
}): boolean {
  return bounty.status === "open" && !isBountyValidityExpired(bounty.validUntil);
}

/** 例如「不限」或「2026年9月1日15点」 */
export function formatBountyValidUntil(validUntil?: string | null): string {
  if (!validUntil) return "不限";
  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return "不限";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}点`;
}

export function formatBountyValidUntilLabel(validUntil?: string | null): string {
  if (!validUntil) return "不限";
  const text = formatBountyValidUntil(validUntil);
  return isBountyValidityExpired(validUntil) ? `${text}（已过期）` : text;
}

/** 成果提交时间：空 / 协商确定；有值 = 整点 ISO（旧数据可为 YYYY-MM-DD） */
export type BountyDeadlineDraft = {
  mode: "negotiate" | "until";
  date: string;
  hour: string;
};

export function emptyBountyDeadlineDraft(): BountyDeadlineDraft {
  return { mode: "negotiate", date: "", hour: "" };
}

export function isBountyDeadlineNegotiated(deadline?: string | null): boolean {
  if (deadline == null) return true;
  const trimmed = deadline.trim();
  return trimmed === "" || trimmed === "negotiate" || trimmed === "协商确定";
}

export function draftFromDeadline(deadline?: string | null): BountyDeadlineDraft {
  if (isBountyDeadlineNegotiated(deadline)) return emptyBountyDeadlineDraft();
  const trimmed = deadline!.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { mode: "until", date: trimmed, hour: "0" };
  }
  const parts = toValidUntilLocalParts(trimmed);
  if (!parts) return emptyBountyDeadlineDraft();
  return { mode: "until", date: parts.date, hour: String(parts.hour) };
}

export function isDeadlineDraftComplete(draft: BountyDeadlineDraft): boolean {
  if (draft.mode === "negotiate") return true;
  return isValidUntilDraftComplete({
    mode: "until",
    date: draft.date,
    hour: draft.hour,
  });
}

export function deadlineFromDraft(draft: BountyDeadlineDraft): string {
  if (draft.mode === "negotiate") return "";
  return (
    validUntilFromDraft({
      mode: "until",
      date: draft.date,
      hour: draft.hour,
    }) ?? ""
  );
}

export function normalizeBountyDeadline(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (
    input == null ||
    input === "" ||
    input === "negotiate" ||
    input === "协商确定"
  ) {
    return { ok: true, value: "" };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "成果提交时间格式无效" };
  }
  const iso = parseHourPrecisionToIso(input);
  if (!iso) {
    return {
      ok: false,
      error: "成果提交时间须精确到整点，或选择协商确定",
    };
  }
  return { ok: true, value: iso };
}

/** 例如「协商确定」或「2026年10月21日15点」；旧日期仅显示到日 */
export function formatBountyDeadline(deadline?: string | null): string {
  if (isBountyDeadlineNegotiated(deadline)) return "协商确定";
  const trimmed = deadline!.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return `${year}年${month}月${day}日`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "协商确定";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}点`;
}
