"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveWithdrawalRequest } from "@/lib/api-client";
import {
  DESIGN_SUBJECT_TYPE_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  type DesignSubjectType,
  type WithdrawalFeeItem,
  type WithdrawalRequest,
} from "@/lib/withdrawal-requests";
import { useWithdrawalRequests } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CheckCircle2,
  PackageSearch,
  Search,
  User2,
  Users,
  XCircle,
} from "lucide-react";

type SubjectFilter = DesignSubjectType | "all";
type QueueTab = "pending" | "history";

const SUBJECT_FILTERS: { value: SubjectFilter; label: string }[] = [
  { value: "all", label: "全部主体" },
  { value: "individual", label: "个人设计师" },
  { value: "team", label: "设计团队" },
  { value: "company", label: "设计公司" },
];

function subjectIcon(type: DesignSubjectType) {
  if (type === "company") return Building2;
  if (type === "team") return Users;
  return User2;
}

export function AdminWithdrawalQueue() {
  const base = useConsoleBasePath();
  const push = useSessionStore((s) => s.pushNotification);
  const { data: requests, refresh } = useWithdrawalRequests();
  const [tab, setTab] = useState<QueueTab>("pending");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [feeDetailTarget, setFeeDetailTarget] =
    useState<WithdrawalRequest | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  const filterList = (list: WithdrawalRequest[]) => {
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      if (subjectFilter !== "all" && r.subjectType !== subjectFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        r.designerName,
        r.designerCode,
        r.accountHolder,
        r.bankName,
        r.levelLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  };

  const filteredPending = useMemo(
    () => filterList(pending),
    [pending, query, subjectFilter],
  );
  const filteredHistory = useMemo(
    () => filterList(history),
    [history, query, subjectFilter],
  );

  const handleAction = async (
    item: WithdrawalRequest,
    action: "approve" | "reject" | "pay",
    reason?: string,
  ) => {
    try {
      await resolveWithdrawalRequest(item.id, action, reason);
      push({
        title:
          action === "approve"
            ? `已通过提现 · ${item.designerName}`
            : action === "pay"
              ? `已确认打款 · ${item.designerName}`
              : `已驳回提现 · ${item.designerName}`,
        variant: action === "reject" ? "destructive" : "success",
        description:
          action === "approve"
            ? `${formatCurrency(item.amount)} 待财务打款。`
            : action === "pay"
              ? `${formatCurrency(item.amount)} 已标记为打款完成。`
              : reason,
      });
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await handleAction(rejectTarget, "reject", rejectReason.trim());
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索设计师、编号、开户名、银行"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSubjectFilter(item.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                subjectFilter === item.value
                  ? "border-ink bg-ink text-white"
                  : "border-ink-20 text-ink-60 hover:border-ink/40",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as QueueTab)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            待审批
            <Badge variant="muted">{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            历史记录
            <Badge variant="muted">{history.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {filteredPending.length === 0 ? (
            <EmptyState text="暂无待审批的提现申请。" />
          ) : (
            filteredPending.map((item) => (
              <WithdrawalCard
                key={item.id}
                item={item}
                onViewFees={() => setFeeDetailTarget(item)}
                onApprove={() => handleAction(item, "approve")}
                onReject={() => {
                  setRejectTarget(item);
                  setRejectReason("");
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <EmptyState text="暂无历史提现记录。" />
          ) : (
            filteredHistory.map((item) => (
              <WithdrawalCard
                key={item.id}
                item={item}
                onViewFees={
                  item.feeItems?.length
                    ? () => setFeeDetailTarget(item)
                    : undefined
                }
                onPay={
                  item.status === "approved"
                    ? () => handleAction(item, "pay")
                    : undefined
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <WithdrawalFeeDetailDialog
        item={feeDetailTarget}
        base={base}
        onClose={() => setFeeDetailTarget(null)}
      />

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回提现申请</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `${rejectTarget.designerName} · ${formatCurrency(rejectTarget.amount)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>驳回理由</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="如：冻结期未满、余额不足、账户信息有误等"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={submitReject}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-20 py-12 text-center text-sm text-ink-60">
      {text}
    </div>
  );
}

function WithdrawalFeeDetailDialog({
  item,
  base,
  onClose,
}: {
  item: WithdrawalRequest | null;
  base: string;
  onClose: () => void;
}) {
  const feeItems = item?.feeItems ?? [];
  const feeTotal = feeItems.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>提现费用明细</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.designerName} · 本次申请 ${formatCurrency(item.amount)}`
              : null}
          </DialogDescription>
        </DialogHeader>

        {feeItems.length === 0 ? (
          <p className="text-sm text-ink-60">暂无关联的费用明细。</p>
        ) : (
          <div className="space-y-3">
            {feeItems.map((row) => (
              <FeeItemRow key={`${row.orderId}-${row.stageId}`} row={row} base={base} />
            ))}
            <div className="flex items-center justify-between border-t border-ink-20 pt-3 text-sm">
              <span className="text-ink-60">
                共 {feeItems.length} 笔可提现款项
              </span>
              <span className="font-semibold text-ink">
                合计 {formatCurrency(feeTotal)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeeItemRow({
  row,
  base,
}: {
  row: WithdrawalFeeItem;
  base: string;
}) {
  return (
    <div className="rounded-lg border border-ink-20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold leading-snug text-ink">
            {row.orderTitle}
          </p>
          <p className="text-xs text-ink-60">
            {row.orderCode} · {row.stageName}
          </p>
          {row.releasedAt ? (
            <p className="text-xs text-ink-40">
              解冻时间 {formatDateTime(row.releasedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-base font-semibold tabular-nums text-ink">
            {formatCurrency(row.amount)}
          </span>
          <Link
            href={`${base}/orders/${row.orderId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:gap-1.5 transition-all"
          >
            查看订单
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function WithdrawalCard({
  item,
  onViewFees,
  onApprove,
  onReject,
  onPay,
}: {
  item: WithdrawalRequest;
  onViewFees?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onPay?: () => void;
}) {
  const Icon = subjectIcon(item.subjectType);
  const statusTone =
    item.status === "pending"
      ? "amber"
      : item.status === "approved"
        ? "blue"
        : item.status === "paid"
          ? "emerald"
          : "rose";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusTone}>
              {WITHDRAWAL_STATUS_LABELS[item.status]}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Icon className="h-3 w-3" />
              {DESIGN_SUBJECT_TYPE_LABELS[item.subjectType]}
            </Badge>
            <span className="text-xs text-ink-40">{item.designerCode}</span>
          </div>
          <div>
            <h4 className="text-base font-semibold text-ink">
              {item.designerName}
            </h4>
            <p className="mt-0.5 text-xs text-ink-60">
              {item.levelLabel} · 申请 {formatDateTime(item.submittedAt)}
            </p>
          </div>
          <div className="grid gap-2 text-xs text-ink-60 sm:grid-cols-2">
            <span>
              提现金额{" "}
              <strong className="text-ink">
                {formatCurrency(item.amount)}
              </strong>
            </span>
            <span>
              申请前可提现 {formatCurrency(item.availableBefore)}
            </span>
            <span>
              收款账户 {item.bankName}（{item.accountTail}）· {item.accountHolder}
            </span>
            {item.note ? <span>备注 {item.note}</span> : null}
            {item.rejectReason ? (
              <span className="text-rose-600">驳回理由 {item.rejectReason}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onViewFees ? (
            <Button variant="outline" size="sm" onClick={onViewFees}>
              <PackageSearch className="h-3.5 w-3.5" />
              查看订单
            </Button>
          ) : null}
          {onApprove ? (
            <Button variant="brand" size="sm" onClick={onApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              通过审批
            </Button>
          ) : null}
          {onReject ? (
            <Button variant="outline" size="sm" onClick={onReject}>
              <XCircle className="h-3.5 w-3.5" />
              驳回
            </Button>
          ) : null}
          {onPay ? (
            <Button variant="brand" size="sm" onClick={onPay}>
              确认打款
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
