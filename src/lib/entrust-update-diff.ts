import { TAX_OPTIONS } from "@/lib/constants";
import { parseRegularEntrustDescription } from "@/lib/entrust-description";
import { extractTimeQuoteLineInputsFromOrder } from "@/lib/regular-entrust-quote";
import type { Order } from "@/lib/types";

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function display(value: unknown): string {
  return text(value) || "（空）";
}

function sameText(a: unknown, b: unknown): boolean {
  return text(a) === text(b);
}

function taxLabel(coefficient?: number): string {
  if (coefficient == null || !Number.isFinite(coefficient)) return "—";
  const hit = TAX_OPTIONS.find(
    (t) => Math.abs(t.coefficient - coefficient) < 0.001,
  );
  return hit?.label ?? `系数 ${coefficient}`;
}

function serviceModeLabel(mode?: string): string {
  if (mode === "onsite") return "线下上门";
  if (mode === "online") return "纯线上";
  return display(mode);
}

function dateLabel(iso?: string): string {
  const raw = text(iso);
  if (!raw) return "（空）";
  return raw.slice(0, 10);
}

function yesNo(v: boolean): string {
  return v ? "已开通" : "未开通";
}

function difficultyText(label?: string, value?: number): string {
  const name = text(label);
  const pct =
    value != null && Number.isFinite(value)
      ? `${Math.round(value * 100)}%`
      : "";
  if (!name && !pct) return "—";
  return [name, pct].filter(Boolean).join(" ");
}

function unitLabel(order: Order): string {
  return order.billingMode === "monthly" ? "个月" : "工日";
}

/** 对比修改前后的委托信息，生成给委托人看的变更条目 */
export function describeEntrustUpdates(before: Order, after: Order): string[] {
  const changes: string[] = [];
  const pushChange = (label: string, from: unknown, to: unknown) => {
    if (sameText(from, to)) return;
    changes.push(`· ${label}：${display(from)} → ${display(to)}`);
  };

  pushChange("项目标题", before.title, after.title);
  pushChange("项目类型", before.projectType, after.projectType);
  pushChange(
    "服务模式",
    serviceModeLabel(before.serviceMode),
    serviceModeLabel(after.serviceMode),
  );
  pushChange(
    "预期交付",
    dateLabel(before.expectedDeliveryAt),
    dateLabel(after.expectedDeliveryAt),
  );
  pushChange(
    "第三方审图",
    yesNo(Boolean(before.withAuditService)),
    yesNo(Boolean(after.withAuditService)),
  );
  pushChange(
    "项目管理",
    yesNo(Boolean(before.withProjectManagement)),
    yesNo(Boolean(after.withProjectManagement)),
  );

  const beforeArea = before.projectAreaSqm;
  const afterArea = after.projectAreaSqm;
  if ((beforeArea ?? 0) !== (afterArea ?? 0)) {
    pushChange(
      "项目面积",
      beforeArea ? `${beforeArea} ㎡` : "",
      afterArea ? `${afterArea} ㎡` : "",
    );
  }

  const beforeTax =
    before.quote?.taxCoefficient ?? before.levelQuotes?.[0]?.taxCoefficient;
  const afterTax =
    after.quote?.taxCoefficient ?? after.levelQuotes?.[0]?.taxCoefficient;
  if (
    beforeTax != null &&
    afterTax != null &&
    Math.abs(beforeTax - afterTax) >= 0.001
  ) {
    pushChange("税率", taxLabel(beforeTax), taxLabel(afterTax));
  } else if ((beforeTax == null) !== (afterTax == null) && afterTax != null) {
    pushChange("税率", taxLabel(beforeTax), taxLabel(afterTax));
  }

  const parsedBefore = parseRegularEntrustDescription(before.description ?? "");
  const parsedAfter = parseRegularEntrustDescription(after.description ?? "");
  const briefBefore = parsedBefore.structured
    ? parsedBefore.brief
    : before.description ?? "";
  const briefAfter = parsedAfter.structured
    ? parsedAfter.brief
    : after.description ?? "";
  if (!sameText(briefBefore, briefAfter)) {
    if (text(briefBefore).length <= 40 && text(briefAfter).length <= 40) {
      pushChange("项目说明", briefBefore, briefAfter);
    } else {
      changes.push("· 项目说明：已更新");
    }
  }

  const contactBefore = parsedBefore.contact;
  const contactAfter = parsedAfter.contact;
  pushChange("委托方", contactBefore?.committerName, contactAfter?.committerName);
  pushChange("联系人", contactBefore?.contactName, contactAfter?.contactName);
  pushChange("联系电话", contactBefore?.contactPhone, contactAfter?.contactPhone);
  pushChange("项目城市", contactBefore?.projectCity, contactAfter?.projectCity);

  const unit = unitLabel(after);
  const beforeLines = extractTimeQuoteLineInputsFromOrder(before);
  const afterLines = extractTimeQuoteLineInputsFromOrder(after);
  const lineKeys = new Set([
    ...beforeLines.map((l) => l.l3),
    ...afterLines.map((l) => l.l3),
  ]);
  for (const key of lineKeys) {
    const prev = beforeLines.find((l) => l.l3 === key);
    const next = afterLines.find((l) => l.l3 === key);
    const label = next?.l3Label || prev?.l3Label || key;
    if (prev && !next) {
      changes.push(`· ${label}：已移除`);
      continue;
    }
    if (!prev && next) {
      changes.push(
        `· ${label}：新增 ${next.quantity} ${unit}，难度${difficultyText(next.difficultyLabel, next.difficulty)}`,
      );
      continue;
    }
    if (!prev || !next) continue;
    if (prev.quantity !== next.quantity) {
      pushChange(
        `${label}工时`,
        `${prev.quantity} ${unit}`,
        `${next.quantity} ${unit}`,
      );
    }
    const prevDiff = difficultyText(prev.difficultyLabel, prev.difficulty);
    const nextDiff = difficultyText(next.difficultyLabel, next.difficulty);
    if (prevDiff !== nextDiff) {
      pushChange(`${label}难度`, prevDiff, nextDiff);
    }
  }

  const beforeFiles = (before.attachments ?? []).map((a) => a.name);
  const afterFiles = (after.attachments ?? []).map((a) => a.name);
  const addedFiles = afterFiles.filter((n) => !beforeFiles.includes(n));
  const removedFiles = beforeFiles.filter((n) => !afterFiles.includes(n));
  if (addedFiles.length || removedFiles.length) {
    const bits = [
      addedFiles.length ? `新增 ${addedFiles.join("、")}` : "",
      removedFiles.length ? `移除 ${removedFiles.join("、")}` : "",
    ].filter(Boolean);
    changes.push(`· 附件：${bits.join("；")}`);
  }

  return changes;
}
