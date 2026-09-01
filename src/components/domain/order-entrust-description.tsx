"use client";

import type { ReactNode } from "react";
import {
  labelEntrustBillingMode,
  parseRegularEntrustDescription,
} from "@/lib/entrust-description";
import {
  resolveTimeDifficultyDisplay,
  type TimeDifficultyDisplay,
} from "@/lib/landscape-area-difficulty";
import type { BountyTrack, ClientLevel, OrderQuoteLine } from "@/lib/types";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import {
  maskPhonesInText,
  resolveVisiblePhone,
} from "@/lib/designer-contact-privacy";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";
import { ClientLevelBadge } from "@/components/domain/level-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Building2, Clock3, IdCard, MapPin, Phone, Smartphone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const BILLING_META_LABELS = new Set([
  "二级专业",
  "面积",
  "税率",
  "建造类型",
  "工时",
  "雇佣",
  "三级专业",
  "服务方式",
  "专业档位",
  "计费单位",
  "服务期",
  "已选日期",
  "折算明细",
  "数量",
  "单价",
  "委托人填写费用",
  "平台服务费",
]);

const AREA_L3_MARKER = " · 三级专业：";

function splitSpecialtyLabels(raw: string): string[] {
  return raw
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "—");
}

function extrasFromQuoteLines(quoteLines?: OrderQuoteLine[]): {
  area?: string;
  l3Labels: string[];
} {
  if (!quoteLines?.length) return { l3Labels: [] };
  const sqm = quoteLines.find((l) => l.unit === "sqm");
  const l3Labels = [
    ...new Set(
      quoteLines
        .map((l) => (l.l3Label || l.trackLabel || "").trim())
        .filter(Boolean),
    ),
  ];
  return {
    area: sqm ? `${sqm.quantity} ㎡` : undefined,
    l3Labels,
  };
}

/** 从计费摘要抽出面积 / 三级专业，并从计费卡片中去掉（改到专业需求展示） */
function extractSpecialtyFromBilling(detailLines: string[]): {
  area?: string;
  l3Labels: string[];
  remaining: string[];
} {
  let area: string | undefined;
  const l3Labels: string[] = [];
  const remaining: string[] = [];

  for (const line of detailLines) {
    if (line.startsWith("面积：")) {
      const value = line.slice("面积：".length).trim();
      const markerIdx = value.indexOf(AREA_L3_MARKER);
      if (markerIdx >= 0) {
        area = value.slice(0, markerIdx).trim() || undefined;
        l3Labels.push(
          ...splitSpecialtyLabels(value.slice(markerIdx + AREA_L3_MARKER.length)),
        );
      } else {
        area = value || undefined;
      }
      continue;
    }
    if (line.startsWith("二级专业：")) continue;
    if (line.startsWith("三级专业：")) {
      l3Labels.push(...splitSpecialtyLabels(line.slice("三级专业：".length)));
      continue;
    }
    remaining.push(line);
  }

  return { area, l3Labels: [...new Set(l3Labels)], remaining };
}

export function quoteLinesFromOrder(order: {
  quote?: { lines?: OrderQuoteLine[] } | null;
  levelQuotes?: Array<{ lines?: OrderQuoteLine[] }> | null;
}): OrderQuoteLine[] | undefined {
  if (order.quote?.lines?.length) return order.quote.lines;
  return order.levelQuotes?.find((q) => q.lines?.length)?.lines;
}

function parseDifficultyRaw(raw: string): TimeDifficultyDisplay | null {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/^(.+?)\s+(\d+%)(?:（(.+)）)?$/);
  if (!m) {
    return { label: text, value: 1, percent: "" };
  }
  const percent = m[2];
  const n = Number.parseInt(percent, 10);
  return {
    label: m[1].trim(),
    value: Number.isFinite(n) ? n / 100 : 1,
    percent,
    remark: m[3]?.trim() || undefined,
  };
}

function difficultyFromQuoteLine(
  line: OrderQuoteLine,
): TimeDifficultyDisplay | null {
  return resolveTimeDifficultyDisplay({
    track: line.track,
    difficulty: line.difficulty,
    difficultyLabel: line.difficultyLabel,
  });
}

function matchQuoteLine(
  name: string,
  quoteLines?: OrderQuoteLine[],
): OrderQuoteLine | undefined {
  if (!quoteLines?.length) return undefined;
  return (
    quoteLines.find((l) => (l.l3Label ?? "") === name) ??
    quoteLines.find((l) => l.trackLabel === name) ??
    quoteLines.find((l) => name.includes(l.trackLabel) || name.includes(l.l3Label ?? ""))
  );
}

function BillingDetailRow({
  line,
  quoteLines,
}: {
  line: string;
  quoteLines?: OrderQuoteLine[];
}) {
  const sep = line.indexOf("：");
  if (sep < 0) {
    return <li className="text-ink-60">{line}</li>;
  }
  const label = line.slice(0, sep).trim();
  const value = line.slice(sep + 1).trim();

  if (BILLING_META_LABELS.has(label)) {
    return (
      <li className="text-sm text-ink">
        <span className="text-ink-40">{label} · </span>
        {value}
      </li>
    );
  }

  const difficultyIdx = value.indexOf(" · 难度");
  const qty =
    difficultyIdx >= 0 ? value.slice(0, difficultyIdx).trim() : value;
  const difficultyRaw =
    difficultyIdx >= 0
      ? value.slice(difficultyIdx + " · 难度".length).trim()
      : undefined;
  const quoted = matchQuoteLine(label, quoteLines);
  const fromText = parseDifficultyRaw(difficultyRaw ?? "");
  const fromQuote = quoted ? difficultyFromQuoteLine(quoted) : null;
  const difficulty = fromText
    ? {
        ...fromQuote,
        ...fromText,
        remark: fromText.remark ?? fromQuote?.remark,
      }
    : fromQuote;

  return (
    <li className="space-y-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm text-ink">
          <span className="text-ink-40">三级专业 · </span>
          {label}
        </span>
        <span className="tabular-nums font-medium text-ink">{qty}</span>
      </div>
      {difficulty ? (
        <>
          <div className="text-[12px] text-ink-60">
            难度{difficulty.label}
            {difficulty.percent ? ` · 系数 ${difficulty.percent}` : ""}
          </div>
          {difficulty.remark ? (
            <p className="text-[11px] leading-relaxed text-ink-40">
              {difficulty.remark}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

function SpecialtyDemandCard({
  track,
  area,
  extraL3Labels = [],
}: {
  track?: BountyTrack;
  area?: string;
  extraL3Labels?: string[];
}) {
  const parts = track
    ? getTrackLabelParts(track)
    : { l1: "", l2List: [] as string[], l3List: [] as string[] };
  const l3List = parts.l3List.length > 0 ? parts.l3List : extraL3Labels;
  return (
    <section className="rounded-xl border border-ink-20 bg-ink-20/15 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
        专业需求
      </div>
      <dl className="mt-3 space-y-2.5">
        <div className="text-sm">
          <dt className="text-[11px] text-ink-40">一级专业</dt>
          <dd className="mt-0.5 font-medium text-ink">{parts.l1 || "—"}</dd>
        </div>
        <div className="text-sm">
          <dt className="text-[11px] text-ink-40">二级专业</dt>
          <dd className="mt-0.5 space-y-1 font-medium text-ink">
            {parts.l2List.length > 0 ? (
              parts.l2List.map((label) => <div key={label}>{label}</div>)
            ) : (
              <div>—</div>
            )}
          </dd>
        </div>
        <div className="text-sm">
          <dt className="text-[11px] text-ink-40">三级专业</dt>
          <dd className="mt-0.5 space-y-1 font-medium text-ink">
            {l3List.length > 0 ? (
              l3List.map((label) => <div key={label}>{label}</div>)
            ) : (
              <div>—</div>
            )}
          </dd>
        </div>
        {area ? (
          <div className="text-sm">
            <dt className="text-[11px] text-ink-40">面积</dt>
            <dd className="mt-0.5 font-medium text-ink">{area}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function OrderEntrustDescription({
  description,
  className,
  quoteLines,
  primaryTrack,
  orderer,
  afterNotes,
  revealContactPhone = false,
}: {
  description: string;
  className?: string;
  quoteLines?: OrderQuoteLine[];
  /** 悬赏等：展示一 / 二 / 三级专业需求 */
  primaryTrack?: BountyTrack;
  /** 管理员 / 超级管理员：展示下单账号信息 */
  orderer?: {
    name: string;
    avatar?: string | null;
    phone?: string | null;
    level?: ClientLevel | null;
  } | null;
  /** 项目备注下方插槽 */
  afterNotes?: ReactNode;
  /** 双方签完合同或管理员 / 本人可见完整电话 */
  revealContactPhone?: boolean;
}) {
  const parsed = parseRegularEntrustDescription(description);
  const visibleDescription = revealContactPhone
    ? description
    : maskPhonesInText(description || "");
  const contactPhone = resolveVisiblePhone(
    parsed.contact?.contactPhone,
    revealContactPhone,
  );
  const ordererPhone = resolveVisiblePhone(orderer?.phone, revealContactPhone);

  const quoteExtras = extrasFromQuoteLines(quoteLines);
  const billingExtras = parsed.billing
    ? extractSpecialtyFromBilling(parsed.billing.detailLines)
    : { area: undefined, l3Labels: [] as string[], remaining: [] as string[] };
  const specialtyArea = billingExtras.area ?? quoteExtras.area;
  const specialtyL3 =
    billingExtras.l3Labels.length > 0
      ? billingExtras.l3Labels
      : quoteExtras.l3Labels;
  const showSpecialtyCard =
    Boolean(primaryTrack) || Boolean(specialtyArea) || specialtyL3.length > 0;

  if (!parsed.structured) {
    return (
      <div className={className ?? "mt-4 space-y-4"}>
        {showSpecialtyCard ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SpecialtyDemandCard
              track={primaryTrack}
              area={specialtyArea}
              extraL3Labels={specialtyL3}
            />
          </div>
        ) : null}
        <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-60">
          {visibleDescription || "—"}
        </p>
        {afterNotes}
      </div>
    );
  }

  const contactRows = parsed.contact
    ? (
        [
          parsed.contact.committerName
            ? {
                icon: Building2,
                label: "委托方",
                value: parsed.contact.committerName,
              }
            : null,
          parsed.contact.contactName
            ? {
                icon: UserRound,
                label: "联系人",
                value: parsed.contact.contactName,
              }
            : null,
          contactPhone
            ? {
                icon: Phone,
                label: "电话",
                value: contactPhone.display,
                href: contactPhone.href,
              }
            : null,
          parsed.contact.projectCity
            ? {
                icon: MapPin,
                label: "项目城市",
                value: parsed.contact.projectCity,
              }
            : null,
        ] as const
      ).filter(Boolean)
    : [];

  return (
    <div className={className ?? "mt-4 space-y-4"}>
      <div
        className={cn(
          "grid gap-3",
          orderer ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {orderer ? (
          <section className="rounded-xl border border-ink-20 bg-ink-20/15 p-4">
            <div className="flex items-center gap-2">
              <IdCard className="h-3.5 w-3.5 text-ink-40" />
              <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                下单人信息
              </div>
            </div>
            <dl className="mt-3 space-y-2.5">
              <div className="flex items-start gap-2.5 text-sm">
                <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-ink-20">
                  {orderer.avatar ? (
                    <AvatarImage src={orderer.avatar} alt={orderer.name} />
                  ) : null}
                  <AvatarFallback className="bg-white text-xs font-medium text-ink">
                    {(orderer.name || "—").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <dt className="text-[11px] text-ink-40">昵称</dt>
                  <dd className="mt-0.5 break-words font-medium text-ink">
                    {orderer.name || "—"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-40" />
                <div className="min-w-0">
                  <dt className="text-[11px] text-ink-40">手机号码</dt>
                  <dd className="mt-0.5 break-words font-medium text-ink">
                    {ordererPhone?.href ? (
                      <a href={ordererPhone.href} className="hover:text-brand">
                        {ordererPhone.display}
                      </a>
                    ) : (
                      ordererPhone?.display ?? "—"
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-40" />
                <div className="min-w-0">
                  <dt className="text-[11px] text-ink-40">用户等级</dt>
                  <dd className="mt-1">
                    <ClientLevelBadge
                      level={orderer.level ?? DEFAULT_CLIENT_LEVEL}
                    />
                  </dd>
                </div>
              </div>
            </dl>
          </section>
        ) : null}

        {contactRows.length > 0 ? (
          <section className="rounded-xl border border-ink-20 bg-ink-20/15 p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
              委托联系信息
            </div>
            <dl className="mt-3 space-y-2.5">
              {contactRows.map((row) => {
                if (!row) return null;
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-40" />
                    <div className="min-w-0">
                      <dt className="text-[11px] text-ink-40">{row.label}</dt>
                      <dd className="mt-0.5 break-words font-medium text-ink">
                        {row.label === "电话" && "href" in row && row.href ? (
                          <a href={row.href} className="hover:text-brand">
                            {row.value}
                          </a>
                        ) : (
                          row.value
                        )}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>
        ) : null}

        {showSpecialtyCard ? (
          <SpecialtyDemandCard
            track={primaryTrack}
            area={specialtyArea}
            extraL3Labels={specialtyL3}
          />
        ) : null}

        {parsed.billing ? (
          <section
            className={cn(
              "rounded-xl border border-ink-20 bg-ink-20/15 p-4",
              orderer ? "md:col-span-3" : "md:col-span-2",
            )}
          >
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 text-ink-40" />
              <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                计费摘要
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[11px] text-ink-40">计费方式</span>
                <span className="font-medium text-ink">
                  {labelEntrustBillingMode(parsed.billing.billingModeRaw)}
                </span>
              </div>
              {billingExtras.remaining.length > 0 ? (
                <ul className="space-y-2 border-t border-ink-20/80 pt-2.5">
                  {billingExtras.remaining.map((line) => (
                    <BillingDetailRow
                      key={line}
                      line={line}
                      quoteLines={quoteLines}
                    />
                  ))}
                </ul>
              ) : null}
              {parsed.billing.valueAdded.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-t border-ink-20/80 pt-2.5">
                  {parsed.billing.valueAdded.map((v) => (
                    <span
                      key={v}
                      className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] text-ink-60 ring-1 ring-ink-20"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {parsed.brief ? (
        <section className="rounded-xl border border-ink-20 bg-ink-20/15 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
            项目备注
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {revealContactPhone ? parsed.brief : maskPhonesInText(parsed.brief)}
          </p>
        </section>
      ) : null}

      {afterNotes}

      {parsed.footerNote ? (
        <p className="text-xs leading-relaxed text-ink-40">
          {revealContactPhone
            ? parsed.footerNote
            : maskPhonesInText(parsed.footerNote)}
        </p>
      ) : null}
    </div>
  );
}
