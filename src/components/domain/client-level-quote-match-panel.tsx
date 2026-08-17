"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Designer, DesignerLevel, Order } from "@/lib/types";
import { DESIGNER_LEVEL_META } from "@/lib/constants";
import {
  confirmMatchedDesignerRequest,
  matchQuoteCardsRequest,
} from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { CheckCircle2, ExternalLink, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { formatDesignerRatingDisplay } from "@/lib/designer-rating";
import { designerHasL3 } from "@/lib/bounty-tracks";
import { trackPoolTitle } from "@/lib/client-quote-match";
import { needsCsQuoteConfirm } from "@/lib/order-supervision";
import { LevelQuoteCards } from "@/components/domain/level-quote-cards";

export function ClientLevelQuoteMatchPanel({
  order,
  designers,
  onUpdated,
}: {
  order: Order;
  designers: Designer[];
  onUpdated: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const quotes = useMemo(() => {
    if (order.levelQuotes?.length) return order.levelQuotes;
    return order.quote ? [order.quote] : [];
  }, [order.levelQuotes, order.quote]);

  const [selectedLevels, setSelectedLevels] = useState<DesignerLevel[]>(
    () => order.clientMatch?.selectedLevels ?? [],
  );
  /** trackKey → designerId */
  const [pickedByTrack, setPickedByTrack] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const p of order.clientMatch?.trackPools ?? []) {
        if (p.selectedDesignerId) init[p.trackKey] = p.selectedDesignerId;
      }
      return init;
    },
  );
  /** 旧版单人确认 */
  const [pickedDesignerId, setPickedDesignerId] = useState(
    order.clientMatch?.selectedDesignerId ?? "",
  );
  const [busy, setBusy] = useState(false);

  const trackPools = order.clientMatch?.trackPools ?? [];
  const legacyPools = order.clientMatch?.pools ?? [];

  useEffect(() => {
    if (order.clientMatch?.selectedLevels?.length) {
      setSelectedLevels(order.clientMatch.selectedLevels);
    } else if (order.status === "pending_quote" && !order.clientMatch) {
      setSelectedLevels([]);
    }
    if (order.clientMatch?.trackPools?.length) {
      const next: Record<string, string> = {};
      for (const p of order.clientMatch.trackPools) {
        if (p.selectedDesignerId) next[p.trackKey] = p.selectedDesignerId;
      }
      setPickedByTrack(next);
    } else if (!legacyPools.length) {
      setPickedByTrack({});
    }
    if (order.clientMatch?.selectedDesignerId) {
      setPickedDesignerId(order.clientMatch.selectedDesignerId);
    } else if (!legacyPools.length) {
      setPickedDesignerId("");
    }
  }, [
    order.status,
    order.clientMatch,
    order.clientMatch?.selectedLevels,
    order.clientMatch?.selectedDesignerId,
    order.clientMatch?.trackPools,
    legacyPools.length,
  ]);

  const offerPending =
    order.clientMatch?.offerStatus === "pending" ||
    trackPools.some((p) => p.offerStatus === "pending");

  const awaitingCs = needsCsQuoteConfirm(order);

  const canSelectCards =
    !awaitingCs &&
    (order.status === "pending_quote" ||
      (order.status === "matching" && !offerPending));

  const waitingOffer =
    order.status === "pending_designer_accept" &&
    (Boolean(order.clientMatch?.offerDesignerId) ||
      trackPools.some((p) => p.offerStatus === "pending"));

  if (!quotes.length) return null;
  if (
    order.status !== "pending_quote" &&
    order.status !== "matching" &&
    order.status !== "pending_designer_accept"
  ) {
    return null;
  }

  const toggleLevel = (level: DesignerLevel) => {
    if (!canSelectCards) return;
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  const designerById = (id: string) => designers.find((d) => d.id === id);

  const allTracksPicked =
    trackPools.length > 0 &&
    trackPools.every((p) => {
      const id = pickedByTrack[p.trackKey];
      if (!id) return false;
      const d = designerById(id);
      if (!d) return false;
      if (p.l3 && !designerHasL3(d, p.l3)) return false;
      return true;
    });

  const handleMatch = async () => {
    if (awaitingCs || !selectedLevels.length || busy) return;
    setBusy(true);
    try {
      await matchQuoteCardsRequest(order.id, selectedLevels);
      push({
        title: "已匹配备选设计师",
        description: "请分别为每个专业选择设计师并确认。",
        variant: "success",
      });
      setPickedByTrack({});
      setPickedDesignerId("");
      onUpdated();
    } catch (e) {
      push({
        title: "匹配失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmTrackDesigners = async () => {
    if (!allTracksPicked || busy) return;
    setBusy(true);
    try {
      await confirmMatchedDesignerRequest(order.id, {
        selections: trackPools.map((p) => ({
          trackKey: p.trackKey,
          designerId: pickedByTrack[p.trackKey]!,
        })),
      });
      push({
        title: "已向设计师发送邀请",
        description: "各方同意后将进入签约；若拒绝系统会按专业自动改派。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: "确认失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmLegacyDesigner = async () => {
    if (!pickedDesignerId || busy) return;
    setBusy(true);
    try {
      await confirmMatchedDesignerRequest(order.id, pickedDesignerId);
      push({
        title: "已向设计师发送邀请",
        description: "对方同意后将进入签约；若拒绝系统会自动改派。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: "确认失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const showTrackSelect =
    trackPools.length > 0 && order.status === "matching" && !offerPending;
  const showLegacySelect =
    !trackPools.length &&
    legacyPools.length > 0 &&
    order.status === "matching" &&
    !offerPending;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-brand" />
              等级报价卡
            </div>
            <p className="mt-1 text-xs text-ink-60">
              {awaitingCs
                ? "系统按见习 / 中级 / 高级 / 特级四档测算费用，当前仅为参考。客服确认需求后，即可选卡匹配设计师。"
                : order.csQuoteConfirmedAt
                  ? "客服已更新报价。可单选或多选后匹配设计师；匹配后将按委托的每个三级专业分别给出备选，请逐一确认人选。"
                  : "系统按见习 / 中级 / 高级 / 特级四档测算费用。可单选或多选后匹配设计师；匹配后将按委托的每个三级专业分别给出备选，请逐一确认人选。"}
            </p>
          </div>
          {awaitingCs ? (
            <Badge variant="amber">待客服确认</Badge>
          ) : order.status === "pending_quote" ? (
            <Badge variant="amber">待选卡匹配</Badge>
          ) : waitingOffer ? (
            <Badge variant="blue">待设计师确认</Badge>
          ) : trackPools.length || legacyPools.length ? (
            <Badge variant="brand">请确认人选</Badge>
          ) : (
            <Badge variant="muted">匹配中</Badge>
          )}
        </div>

        <LevelQuoteCards
          quotes={quotes}
          selectedLevels={selectedLevels}
          selectable={canSelectCards}
          onToggle={toggleLevel}
        />

        {canSelectCards || awaitingCs ? (
          <div className="space-y-2">
            <Button
              variant="brand"
              disabled={awaitingCs || !selectedLevels.length || busy}
              onClick={handleMatch}
            >
              <Users className="h-4 w-4" />
              {busy
                ? "匹配中..."
                : trackPools.length || legacyPools.length
                  ? "重新匹配设计师"
                  : "匹配设计师"}
            </Button>
            {awaitingCs ? (
              <p className="text-xs leading-relaxed text-ink-60">
                目前我们已经收到您的委托需求，目前的报价卡仅为参考，需要客服根据您的需求进行二次确认后方可匹配设计师。
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      {showTrackSelect ? (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-ink">按专业选择设计师</div>
            <p className="mt-1 text-xs text-ink-60">
              每个三级专业独立一张卡片，请分别选择设计师后统一确认。确认后将向各方发送接单邀请；拒绝时系统会按该专业自动改派。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {trackPools.map((pool) => {
              const candidates = pool.candidates.filter((c) => {
                const d = designerById(c.designerId);
                if (!d) return false;
                if (pool.l3 && !designerHasL3(d, pool.l3)) return false;
                return true;
              });
              const picked =
                candidates.some(
                  (c) => c.designerId === (pickedByTrack[pool.trackKey] ?? ""),
                )
                  ? pickedByTrack[pool.trackKey]
                  : "";
              return (
                <Card key={pool.trackKey} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">
                        {trackPoolTitle(pool)}
                      </div>
                      {pool.quantityHint ? (
                        <div className="mt-0.5 text-[11px] text-ink-40">
                          {pool.quantityHint}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="muted" className="shrink-0">
                      备选 {candidates.length} 人
                    </Badge>
                  </div>

                  {candidates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-ink-20 px-3 py-4 text-xs text-ink-40">
                      该专业暂无符合条件且已开启接单的设计师
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-1">
                      {candidates.map((c) => {
                        const d = designerById(c.designerId);
                        if (!d) return null;
                        const active = picked === d.id;
                        return (
                          <div
                            key={`${pool.trackKey}-${d.id}`}
                            className={cn(
                              "flex flex-col gap-2 rounded-2xl border px-3 py-3 transition-colors",
                              active
                                ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                                : "border-ink-20 bg-white",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setPickedByTrack((prev) => ({
                                  ...prev,
                                  [pool.trackKey]: d.id,
                                }))
                              }
                              className="flex w-full items-start gap-3 text-left"
                            >
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={d.avatar} alt={d.name} />
                                <AvatarFallback>
                                  {d.name.slice(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-ink">
                                  {d.name}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-40">
                                  {d.code ? <span>{d.code}</span> : null}
                                  <span>
                                    评分{" "}
                                    {formatDesignerRatingDisplay(
                                      d.rating,
                                      d.reviewCount,
                                    )}
                                  </span>
                                  <DesignerLevelBadge level={c.level} />
                                </div>
                                {active ? (
                                  <Badge
                                    variant="brand"
                                    className="mt-1.5 text-[10px]"
                                  >
                                    已选
                                  </Badge>
                                ) : null}
                              </div>
                            </button>
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full gap-1 text-xs"
                            >
                              <Link
                                href={`/designers/${d.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                查看主页
                              </Link>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Button
            variant="brand"
            disabled={!allTracksPicked || busy}
            onClick={handleConfirmTrackDesigners}
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy
              ? "确认中..."
              : trackPools.length > 1
                ? "确认各专业所选设计师"
                : "确认所选设计师"}
          </Button>
        </div>
      ) : null}

      {showLegacySelect ? (
        <Card className="space-y-4 p-6">
          <div>
            <div className="text-sm font-semibold text-ink">备选设计师</div>
            <p className="mt-1 text-xs text-ink-60">
              请从下列备选中选择一位设计师并确认。
            </p>
          </div>

          <div className="space-y-4">
            {legacyPools.map((pool) => (
              <div key={pool.level} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-60">
                  <DesignerLevelBadge level={pool.level} />
                  <span>
                    {DESIGNER_LEVEL_META[pool.level].label} · 锁定报价{" "}
                    {formatCurrency(pool.quoteTotal)}
                  </span>
                </div>
                {pool.candidates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-20 px-3 py-4 text-xs text-ink-40">
                    该档暂无符合条件且已开启接单的设计师
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {pool.candidates.map((c) => {
                      const d = designerById(c.designerId);
                      if (!d) return null;
                      const active = pickedDesignerId === d.id;
                      return (
                        <div
                          key={d.id}
                          className={cn(
                            "flex flex-col gap-2 rounded-2xl border px-3 py-3 transition-colors",
                            active
                              ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                              : "border-ink-20 bg-white",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPickedDesignerId(d.id)}
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={d.avatar} alt={d.name} />
                              <AvatarFallback>
                                {d.name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-ink">
                                {d.name}
                              </div>
                              <div className="mt-0.5 text-[11px] text-ink-40">
                                {d.code ? `${d.code} · ` : ""}
                                评分{" "}
                                {formatDesignerRatingDisplay(
                                  d.rating,
                                  d.reviewCount,
                                )}
                              </div>
                              {active ? (
                                <Badge
                                  variant="brand"
                                  className="mt-1.5 text-[10px]"
                                >
                                  已选
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                          <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full gap-1 text-xs"
                          >
                            <Link
                              href={`/designers/${d.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              查看主页
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="brand"
            disabled={!pickedDesignerId || busy}
            onClick={handleConfirmLegacyDesigner}
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy ? "确认中..." : "确认所选设计师"}
          </Button>
        </Card>
      ) : null}

      {waitingOffer && !(order.trackAssignments?.length) ? (
        <Card className="space-y-3 border-blue-200 bg-blue-50/70 p-5">
          <div className="text-sm font-semibold text-blue-950">
            等待设计师确认接单
          </div>
          <p className="text-xs text-blue-900/80">
            已向设计师发送邀请。各方同意后进入签约；若拒绝，系统将按专业自动匹配其他开启接单的设计师。
          </p>
          {trackPools.length > 0 ? (
            <div className="space-y-2">
              {trackPools.map((pool) => {
                const id =
                  pool.offerDesignerId ?? pool.selectedDesignerId ?? "";
                const d = id ? designerById(id) : undefined;
                return (
                  <div
                    key={pool.trackKey}
                    className="flex items-center gap-3 rounded-xl border border-blue-200/80 bg-white/80 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-ink-40">
                        {trackPoolTitle(pool)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium text-ink">
                        {d ? (
                          <>
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={d.avatar} alt={d.name} />
                              <AvatarFallback>
                                {d.name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {d.name}
                              {d.code ? ` · ${d.code}` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-40">待确认</span>
                        )}
                      </div>
                    </div>
                    {pool.offerStatus === "accepted" ? (
                      <Badge variant="brand">已接单</Badge>
                    ) : (
                      <Badge variant="blue">待确认</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : order.clientMatch?.offerDesignerId ? (
            (() => {
              const d = designerById(order.clientMatch.offerDesignerId);
              if (!d) return null;
              return (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200/80 bg-white/80 px-3 py-2.5">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={d.avatar} alt={d.name} />
                    <AvatarFallback>{d.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm font-medium text-ink">
                    {d.name}
                    {d.code ? ` · ${d.code}` : ""}
                  </div>
                </div>
              );
            })()
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
