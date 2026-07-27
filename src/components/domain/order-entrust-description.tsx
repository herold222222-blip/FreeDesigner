"use client";

import {
  labelEntrustBillingMode,
  parseRegularEntrustDescription,
} from "@/lib/entrust-description";
import { Building2, Clock3, MapPin, Phone, UserRound } from "lucide-react";

export function OrderEntrustDescription({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  const parsed = parseRegularEntrustDescription(description);

  if (!parsed.structured) {
    return (
      <p
        className={
          className ??
          "max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-60"
        }
      >
        {description || "—"}
      </p>
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
          parsed.contact.contactPhone
            ? {
                icon: Phone,
                label: "电话",
                value: parsed.contact.contactPhone,
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
      {parsed.brief ? (
        <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-60">
          {parsed.brief}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
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
                        {row.label === "电话" ? (
                          <a
                            href={`tel:${row.value}`}
                            className="hover:text-brand"
                          >
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

        {parsed.billing ? (
          <section className="rounded-xl border border-ink-20 bg-ink-20/15 p-4">
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
              {parsed.billing.detailLines.length > 0 ? (
                <ul className="space-y-1.5 border-t border-ink-20/80 pt-2.5">
                  {parsed.billing.detailLines.map((line) => {
                    const sep = line.indexOf("：");
                    if (sep < 0) {
                      return (
                        <li key={line} className="text-ink-60">
                          {line}
                        </li>
                      );
                    }
                    const label = line.slice(0, sep);
                    const value = line.slice(sep + 1);
                    if (label === "二级专业" || label === "面积") {
                      return (
                        <li key={line} className="text-sm text-ink">
                          <span className="text-ink-40">{label} · </span>
                          {value}
                        </li>
                      );
                    }
                    return (
                      <li
                        key={line}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                      >
                        <span className="text-ink-60">{label}</span>
                        <span className="tabular-nums font-medium text-ink">
                          {value}
                        </span>
                      </li>
                    );
                  })}
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

      {parsed.footerNote ? (
        <p className="text-xs leading-relaxed text-ink-40">{parsed.footerNote}</p>
      ) : null}
    </div>
  );
}
