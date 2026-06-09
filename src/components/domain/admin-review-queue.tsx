"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReviewItems } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { resolveReviewItemRequest } from "@/lib/api-client";
import type { ReviewItem } from "@/lib/types";
import type { Specialty } from "@/lib/types";
import { SPECIALTIES } from "@/lib/constants";
import {
  countReviewItemsBySpecialty,
  filterReviewItems,
  type ReviewSpecialtyFilter,
} from "@/lib/admin-review-filters";
import { reviewQueue as demoReviewQueue } from "@/mocks/reviews";
import { cn, formatDateTime } from "@/lib/utils";
import {
  isInternPromotionReview,
  isLevelPromotionReview,
  promotionApproveLabel,
  promotionRejectLabel,
} from "@/lib/review-promotion";
import {
  Award,
  Building2,
  CheckCircle2,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "off";
const DEMO_REVIEW_IDS = new Set(demoReviewQueue.map((r) => r.id));

export type ReviewQueueTab =
  | "designer"
  | "enterprise"
  | "promotion"
  | "level_promotion"
  | "history";

const VALID_TABS = new Set<ReviewQueueTab>([
  "designer",
  "enterprise",
  "promotion",
  "level_promotion",
  "history",
]);

export function parseReviewQueueTab(value: string | null): ReviewQueueTab {
  if (value && VALID_TABS.has(value as ReviewQueueTab)) {
    return value as ReviewQueueTab;
  }
  return "designer";
}

type AdminReviewQueueProps = {
  initialTab?: ReviewQueueTab;
  showHeader?: boolean;
};

export function AdminReviewQueue({
  initialTab = "designer",
  showHeader = true,
}: AdminReviewQueueProps) {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: reviewQueue, refresh } = useReviewItems();
  const [queueTab, setQueueTab] = useState<ReviewQueueTab>(initialTab);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] =
    useState<ReviewSpecialtyFilter>("all");

  useEffect(() => {
    setQueueTab(initialTab);
  }, [initialTab]);

  const designerQueue = reviewQueue.filter(
    (r) => r.type === "designer" && r.status === "pending",
  );
  const enterpriseQueue = reviewQueue.filter(
    (r) => r.type === "enterprise" && r.status === "pending",
  );
  const promotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_promotion" && r.status === "pending",
  );
  const levelPromotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_level_promotion" && r.status === "pending",
  );
  const historyQueue = reviewQueue.filter((r) => r.status !== "pending");

  const designerSpecialtyCounts = useMemo(
    () => countReviewItemsBySpecialty(designerQueue),
    [designerQueue],
  );

  const filteredDesignerQueue = useMemo(
    () => filterReviewItems(designerQueue, query, specialtyFilter),
    [designerQueue, query, specialtyFilter],
  );
  const filteredEnterpriseQueue = useMemo(
    () => filterReviewItems(enterpriseQueue, query, "all"),
    [enterpriseQueue, query],
  );
  const filteredPromotionQueue = useMemo(
    () => filterReviewItems(promotionQueue, query, "all"),
    [promotionQueue, query],
  );
  const filteredLevelPromotionQueue = useMemo(
    () => filterReviewItems(levelPromotionQueue, query, "all"),
    [levelPromotionQueue, query],
  );
  const filteredHistoryQueue = useMemo(
    () => filterReviewItems(historyQueue, query, "all"),
    [historyQueue, query],
  );

  const toggleSpecialty = (value: Specialty) => {
    setSpecialtyFilter((current) => (current === value ? "all" : value));
  };

  const handleApprove = async (item: ReviewItem) => {
    try {
      await resolveReviewItemRequest(item.id, "approve");
      const target = item.payload["申请晋升"];
      push({
        title: isInternPromotionReview(item)
          ? `已晋升为中级设计师v1 · ${item.name}`
          : isLevelPromotionReview(item)
            ? `已批准等级晋级 · ${item.name}`
            : `已通过审核 · ${item.name}`,
        variant: "success",
        description: isInternPromotionReview(item)
          ? "该设计师已解除见习接单限制。"
          : isLevelPromotionReview(item)
            ? target
              ? `已晋升至「${target}」。`
              : "等级已更新。"
            : "已发送通知,账号正式上线。",
      });
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (item: ReviewItem) => {
    try {
      await resolveReviewItemRequest(item.id, "reject");
      push({
        title: isInternPromotionReview(item)
          ? `暂不晋升 · ${item.name}`
          : isLevelPromotionReview(item)
            ? `已驳回等级晋级 · ${item.name}`
            : `已驳回 · ${item.name}`,
        variant: "destructive",
        description: isInternPromotionReview(item)
          ? "该设计师维持见习等级，仍受同时仅接 1 单限制。"
          : isLevelPromotionReview(item)
            ? "该设计师维持当前等级，可完善评价数据后重新申请。"
            : "已通知申请人完善资料后重新提交。",
      });
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      {showHeader ? (
        <div className="mb-5">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            入驻审核队列
          </h3>
          <p className="mt-1 text-xs text-ink-60">
            设计首次入驻与企业委托人营业执照,需在 1 个工作日内反馈。
          </p>
        </div>
      ) : null}

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索姓名、手机号、所在地、专业方向等"
            className="h-11 pl-10"
          />
        </div>

        {queueTab === "designer" ? (
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((specialty) => {
              const active = specialtyFilter === specialty.value;
              return (
                <button
                  key={specialty.value}
                  type="button"
                  onClick={() => toggleSpecialty(specialty.value)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
                  )}
                >
                  <span>{specialty.label}</span>
                  <span
                    className={cn(
                      "ml-1.5 tabular-nums",
                      active ? "text-white/80" : "text-ink-40",
                    )}
                  >
                    {designerSpecialtyCounts[specialty.value]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <Tabs
        value={queueTab}
        onValueChange={(v) => setQueueTab(v as ReviewQueueTab)}
      >
        <TabsList>
          <TabsTrigger value="designer" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            设计首次入驻
            <Badge variant="muted">{designerQueue.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="gap-2">
            <Building2 className="h-3.5 w-3.5" />
            企业委托人
            <Badge variant="muted">{enterpriseQueue.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="promotion" className="gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            见习晋级
            <Badge variant="muted">{promotionQueue.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="level_promotion" className="gap-2">
            <Award className="h-3.5 w-3.5" />
            等级晋级
            <Badge variant="muted">{levelPromotionQueue.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            历史记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="designer">
          <ReviewItemList
            items={filteredDesignerQueue}
            emptyText={
              designerQueue.length === 0
                ? "暂无待审核的设计首次入驻申请。"
                : "没有符合当前搜索或专业筛选条件的申请。"
            }
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>

        <TabsContent value="enterprise">
          <ReviewItemList
            items={filteredEnterpriseQueue}
            emptyText={
              enterpriseQueue.length === 0
                ? "暂无待审核的企业委托人申请。"
                : "没有符合当前搜索条件的申请。"
            }
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>

        <TabsContent value="promotion">
          <PromotionReviewList
            items={filteredPromotionQueue}
            emptyText={
              promotionQueue.length === 0
                ? "暂无待审批的见习晋级申请。见习设计师完成首单后可在此提交晋级中级申请。"
                : "没有符合当前搜索条件的见习晋级申请。"
            }
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>

        <TabsContent value="level_promotion">
          <PromotionReviewList
            items={filteredLevelPromotionQueue}
            emptyText={
              levelPromotionQueue.length === 0
                ? "暂无待审批的等级晋级申请。中级/高级/特级设计师达标后可主动申请晋级。"
                : "没有符合当前搜索条件的等级晋级申请。"
            }
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {filteredHistoryQueue.length === 0 ? (
              <EmptyState
                text={
                  historyQueue.length === 0
                    ? "暂无历史审核记录。"
                    : "没有符合当前搜索条件的历史记录。"
                }
              />
            ) : (
              filteredHistoryQueue.map((item) => (
                <Card key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {item.status === "approved" ? (
                          <Badge variant="emerald">已通过</Badge>
                        ) : (
                          <Badge variant="rose">已驳回</Badge>
                        )}
                        <h4 className="text-sm font-semibold text-ink">
                          {item.name}
                        </h4>
                        <span className="text-xs text-ink-40">
                          {formatDateTime(item.submittedAt)}
                        </span>
                      </div>
                      {item.payload["驳回理由"] && (
                        <div className="mt-2 text-xs text-ink-60">
                          驳回理由:{item.payload["驳回理由"]}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function PromotionReviewList({
  items,
  emptyText,
  onApprove,
  onReject,
}: {
  items: ReviewItem[];
  emptyText: string;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            badgeVariant="violet"
            badgeLabel={isLevelPromotionReview(item) ? "等级晋级" : "见习晋级"}
            approveLabel={promotionApproveLabel(item)}
            rejectLabel={promotionRejectLabel(item)}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))
      )}
    </div>
  );
}

function ReviewItemList({
  items,
  emptyText,
  onApprove,
  onReject,
}: {
  items: ReviewItem[];
  emptyText: string;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? <EmptyState text={emptyText} /> : null}
      {items.map((item) => (
        <ReviewCard
          key={item.id}
          item={item}
          badgeVariant="amber"
          badgeLabel="待审核"
          approveLabel="通过审核"
          rejectLabel="驳回"
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  item,
  badgeVariant,
  badgeLabel,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  item: ReviewItem;
  badgeVariant: "amber" | "violet";
  badgeLabel: string;
  approveLabel: string;
  rejectLabel: string;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            {DEMO_MODE && DEMO_REVIEW_IDS.has(item.id) ? (
              <Badge variant="muted">演示</Badge>
            ) : null}
            <h4 className="text-base font-semibold text-ink">{item.name}</h4>
            <span className="text-xs text-ink-40">
              提交于 {formatDateTime(item.submittedAt)}
            </span>
          </div>
          <div className="grid gap-x-6 gap-y-1.5 text-xs text-ink-60 md:grid-cols-2">
            {Object.entries(item.payload).map(([k, v]) => (
              <div key={k}>
                <span className="text-ink-40">{k}:</span>{" "}
                <span className="text-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" onClick={() => onReject(item)}>
            <XCircle className="h-3.5 w-3.5" /> {rejectLabel}
          </Button>
          <Button variant="brand" size="sm" onClick={() => onApprove(item)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {approveLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-20 p-8 text-center text-sm text-ink-40">
      {text}
    </div>
  );
}
