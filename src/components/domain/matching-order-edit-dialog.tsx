"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectTypes, TAX_OPTIONS } from "@/lib/constants";
import type { BountyAttachment, Order, ServiceMode } from "@/lib/types";
import { parseRegularEntrustDescription } from "@/lib/entrust-description";
import { expectedDateFieldLabel } from "@/lib/order-lifecycle";
import { buildRegularEntrustDescription } from "@/lib/entrust-submit";
import { landscapeTimeTrackFromL3 } from "@/lib/designer-rates";
import { resolveTimeDifficultyDisplay } from "@/lib/landscape-area-difficulty";
import { extractTimeQuoteLineInputsFromOrder, type RegularTimeQuoteLineInput } from "@/lib/regular-entrust-quote";
import { Download, FileBox, Paperclip, Trash2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import {
  MAX_ATTACHMENT_LABEL,
  findOversizedAttachment,
  oversizedAttachmentMessage,
} from "@/lib/attachment-limits";

export type MatchingOrderEditPayload = {
  title: string;
  description: string;
  projectType: string;
  totalAmount: number;
  expectedDeliveryAt: string;
  serviceMode: ServiceMode;
  withAuditService: boolean;
  withProjectManagement: boolean;
  projectAreaSqm?: number;
  taxCoefficient?: number;
  attachments?: BountyAttachment[];
  timeQuoteLines?: RegularTimeQuoteLineInput[];
};

const FILE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.zip,.rar,.jpg,.jpeg,.png,.webp";

function formatFileSize(size?: number) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function MatchingOrderEditDialog({
  open,
  onOpenChange,
  order,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSave: (payload: MatchingOrderEditPayload) => void;
  saving?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasLevelQuotes = Boolean(order.levelQuotes?.length || order.quote);
  const isTimeQuoteFlow =
    hasLevelQuotes &&
    (order.billingMode === "daily" || order.billingMode === "monthly");

  const [title, setTitle] = useState(order.title);
  const [brief, setBrief] = useState("");
  const [committerName, setCommitterName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projectType, setProjectType] = useState(order.projectType);
  const [totalAmount, setTotalAmount] = useState(String(order.totalAmount));
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState(
    order.expectedDeliveryAt?.slice(0, 10) ?? "",
  );
  const [serviceMode, setServiceMode] = useState<ServiceMode>(order.serviceMode);
  const [withAudit, setWithAudit] = useState(!!order.withAuditService);
  const [withPM, setWithPM] = useState(!!order.withProjectManagement);
  const [area, setArea] = useState(
    order.projectAreaSqm != null ? String(order.projectAreaSqm) : "",
  );
  const [taxCoefficient, setTaxCoefficient] = useState(
    String(order.quote?.taxCoefficient ?? 1),
  );
  const [lines, setLines] = useState<RegularTimeQuoteLineInput[]>([]);
  const [attachments, setAttachments] = useState<BountyAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const projectTypes = useMemo(
    () => getProjectTypes(order.specialty),
    [order.specialty],
  );

  const parsed = useMemo(
    () => parseRegularEntrustDescription(order.description ?? ""),
    [order.description],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(order.title);
    setBrief(parsed.brief || (parsed.structured ? "" : order.description));
    setCommitterName(parsed.contact?.committerName ?? "");
    setContactName(parsed.contact?.contactName ?? "");
    setContactPhone(parsed.contact?.contactPhone ?? "");
    setProjectCity(parsed.contact?.projectCity ?? "");
    setProjectType(order.projectType);
    setTotalAmount(String(order.totalAmount));
    setExpectedDeliveryAt(order.expectedDeliveryAt?.slice(0, 10) ?? "");
    setServiceMode(order.serviceMode);
    setWithAudit(!!order.withAuditService);
    setWithPM(!!order.withProjectManagement);
    setArea(order.projectAreaSqm != null ? String(order.projectAreaSqm) : "");
    setTaxCoefficient(String(order.quote?.taxCoefficient ?? 1));
    setLines(extractTimeQuoteLineInputsFromOrder(order));
    setAttachments(order.attachments ?? []);
  }, [open, order, parsed]);

  const unitLabel = order.billingMode === "monthly" ? "个月" : "工日";
  const l2Labels =
    parsed.billing?.detailLines
      .filter((l) => l.startsWith("二级专业："))
      .flatMap((l) =>
        l
          .slice("二级专业：".length)
          .split(/[、,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ) ?? [];

  const canSubmit =
    !!title.trim() &&
    !!brief.trim() &&
    !!projectType.trim() &&
    !!expectedDeliveryAt &&
    (isTimeQuoteFlow
      ? lines.some((l) => l.quantity > 0)
      : Math.round(Number(totalAmount)) > 0);

  const taxMeta =
    TAX_OPTIONS.find((t) => t.coefficient === Number(taxCoefficient)) ??
    TAX_OPTIONS.find(
      (t) => Math.abs(t.coefficient - Number(taxCoefficient)) < 0.001,
    );

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const oversized = findOversizedAttachment(list);
    if (oversized) {
      push({
        title: "附件过大",
        description: oversizedAttachmentMessage(oversized.name),
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    Promise.all(
      list.map(
        (file) =>
          new Promise<BountyAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(new Error("读取失败"));
                return;
              }
              resolve({ name: file.name, url: reader.result, size: file.size });
            };
            reader.onerror = () => reject(new Error("读取失败"));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((items) => setAttachments((prev) => [...prev, ...items]))
      .catch(() =>
        push({ title: "附件上传失败", description: "请重新选择文件后再试。", variant: "destructive" }),
      )
      .finally(() => {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      });
  };

  const handleSubmit = () => {
    if (!canSubmit || saving) return;
    const description = parsed.structured
      ? buildRegularEntrustDescription({
          description: brief.trim(),
          contactName: contactName.trim() || "—",
          contactPhone: contactPhone.trim() || "—",
          projectCity: projectCity.trim(),
          committerName: committerName.trim() || undefined,
          billingMode: order.billingMode,
          area: Number(area) > 0 ? Number(area) : undefined,
          timeL2Labels: l2Labels,
          timeL3Units: lines.map((row) => {
            const diff = resolveTimeDifficultyDisplay({
              track: landscapeTimeTrackFromL3(row.l3),
              difficulty: row.difficulty,
              difficultyLabel: row.difficultyLabel,
              difficultyKey: row.difficultyKey,
            });
            return {
              label: row.l3Label,
              units: row.quantity,
              unitLabel,
              difficultyLabel: diff?.label ?? row.difficultyLabel,
              difficulty: diff?.value ?? row.difficulty,
              remark: diff?.remark,
            };
          }),
          withAudit,
          withPM,
          taxLabel: taxMeta?.label,
        })
      : brief.trim();

    onSave({
      title: title.trim(),
      description,
      projectType: projectType.trim(),
      totalAmount: isTimeQuoteFlow
        ? Math.max(1, Math.round(order.totalAmount) || 1)
        : Math.round(Number(totalAmount)),
      expectedDeliveryAt,
      serviceMode,
      withAuditService: withAudit,
      withProjectManagement: withPM,
      projectAreaSqm:
        order.billingMode === "area" && Number(area) > 0
          ? Number(area)
          : undefined,
      taxCoefficient: Number(taxCoefficient) || undefined,
      attachments,
      timeQuoteLines: isTimeQuoteFlow ? lines.filter((l) => l.quantity > 0) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>修改委托信息</DialogTitle>
          <DialogDescription>
            {isTimeQuoteFlow
              ? "以下为委托人已提交的详细资料与附件。保存后将按最新内容重新生成等级报价卡；确认后方可开放委托人选卡。"
              : "以下为委托人已提交的详细资料与附件，保存后按最新内容更新费用。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label htmlFor="match-order-title">项目标题</Label>
            <Input
              id="match-order-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="match-order-brief">项目说明</Label>
            <Textarea
              id="match-order-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>委托方</Label>
              <Input
                className="mt-2"
                value={committerName}
                onChange={(e) => setCommitterName(e.target.value)}
              />
            </div>
            <div>
              <Label>联系人</Label>
              <Input
                className="mt-2"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <Label>电话</Label>
              <Input
                className="mt-2"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>项目所在地</Label>
              <Input
                className="mt-2"
                value={projectCity}
                onChange={(e) => setProjectCity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>项目类型</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="选择项目类型" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  {projectType && !projectTypes.includes(projectType) ? (
                    <SelectItem value={projectType}>{projectType}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>服务模式</Label>
              <Select
                value={serviceMode}
                onValueChange={(v) => setServiceMode(v as ServiceMode)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">线上远程</SelectItem>
                  <SelectItem value="onsite">线下上门</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="match-order-delivery">
                {expectedDateFieldLabel(serviceMode)}
              </Label>
              <Input
                id="match-order-delivery"
                type="date"
                value={expectedDeliveryAt}
                onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>税率</Label>
              <Select
                value={taxCoefficient}
                onValueChange={setTaxCoefficient}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={String(t.coefficient)}>
                      {t.label}（×{t.coefficient.toFixed(2)}）
                    </SelectItem>
                  ))}
                  {!TAX_OPTIONS.some(
                    (t) =>
                      Math.abs(t.coefficient - Number(taxCoefficient)) < 0.001,
                  ) ? (
                    <SelectItem value={taxCoefficient}>
                      当前 ×{Number(taxCoefficient).toFixed(2)}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {order.billingMode === "area" ? (
            <div>
              <Label htmlFor="match-order-area">项目面积（㎡）</Label>
              <Input
                id="match-order-area"
                type="number"
                min={1}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-2"
              />
            </div>
          ) : null}

          {!isTimeQuoteFlow ? (
            <div>
              <Label htmlFor="match-order-budget">预算金额（元）</Label>
              <Input
                id="match-order-budget"
                type="number"
                min={1}
                step={100}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="mt-2"
              />
            </div>
          ) : null}

          {isTimeQuoteFlow && lines.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-ink">三级专业工时</div>
              <div className="space-y-2">
                {lines.map((row, i) => (
                  <div
                    key={`${row.l3}-${i}`}
                    className="grid gap-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5 sm:grid-cols-[1fr_120px_120px]"
                  >
                    <div className="min-w-0 text-sm font-medium text-ink">
                      {row.l3Label}
                      {row.difficultyLabel ? (
                        <div className="mt-0.5 text-[11px] font-normal text-ink-40">
                          难度{row.difficultyLabel}{" "}
                          {row.difficulty
                            ? `${Math.round(row.difficulty * 100)}%`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <Label className="text-[11px] text-ink-40">
                        数量（{unitLabel}）
                      </Label>
                      <Input
                        type="number"
                        min={order.billingMode === "daily" ? 0.5 : 1}
                        step={order.billingMode === "daily" ? 0.5 : 1}
                        value={row.quantity}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, quantity: n } : x,
                            ),
                          );
                        }}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-ink-40">难度系数</Label>
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={row.difficulty ?? 1}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, difficulty: n } : x,
                            ),
                          );
                        }}
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-3">
            <div className="text-xs font-medium text-ink">增值服务</div>
            <label className="flex items-center gap-2 text-sm text-ink-60">
              <input
                type="checkbox"
                checked={withAudit}
                onChange={(e) => setWithAudit(e.target.checked)}
              />
              第三方审图
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-60">
              <input
                type="checkbox"
                checked={withPM}
                onChange={(e) => setWithPM(e.target.checked)}
              />
              项目管理
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-ink">项目附件</div>
                <p className="text-[11px] text-ink-40">
                  单文件不超过 {MAX_ATTACHMENT_LABEL}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {uploading ? "上传中..." : "添加附件"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={FILE_ACCEPT}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-ink-40">暂无附件</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((a, i) => (
                  <div
                    key={`${a.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileBox className="h-4 w-4 shrink-0 text-ink-40" />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{a.name}</div>
                        {formatFileSize(a.size) ? (
                          <div className="text-[11px] text-ink-40">
                            {formatFileSize(a.size)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.url ? (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={a.url} download={a.name}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving
              ? "保存中..."
              : isTimeQuoteFlow
                ? "保存并更新费用"
                : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
