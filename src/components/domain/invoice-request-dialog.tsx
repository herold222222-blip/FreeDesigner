"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createInvoiceRequest, fetchInvoiceById } from "@/lib/api-client";
import { invoiceTypeLabel } from "@/lib/invoice";
import type { Client, CreateInvoiceInput, InvoiceRequest, WalletTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

export function InvoiceRequestDialog({
  open,
  onOpenChange,
  transaction,
  client,
  existingInvoice,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: WalletTransaction | null;
  client?: Client | null;
  existingInvoice?: InvoiceRequest | null;
  onIssued?: (invoice: InvoiceRequest) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<InvoiceRequest | null>(existingInvoice ?? null);

  const [title, setTitle] = useState("");
  const [taxId, setTaxId] = useState("");
  const [invoiceType, setInvoiceType] = useState<CreateInvoiceInput["invoiceType"]>("ordinary");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIssued(existingInvoice ?? null);

    if (transaction?.invoiceId) {
      let active = true;
      fetchInvoiceById(transaction.invoiceId)
        .then((inv) => {
          if (active) setIssued(inv);
        })
        .catch(() => {
          if (active && transaction.invoiceNo) {
            setIssued({
              id: transaction.invoiceId!,
              invoiceNo: transaction.invoiceNo,
              clientId: "",
              walletTransactionId: transaction.id,
              orderId: transaction.orderId,
              orderCode: transaction.orderCode,
              orderTitle: transaction.orderTitle,
              amount: Math.abs(transaction.amount),
              title: "",
              taxId: "",
              invoiceType: "ordinary",
              email: "",
              paymentNote: transaction.note,
              status: "issued",
              issuedAt: transaction.occurredAt,
            });
          }
        });
      return () => {
        active = false;
      };
    }

    if (existingInvoice) return;

    const defaultTitle =
      client?.type === "enterprise"
        ? client.companyName || client.name
        : client?.name || "";
    setTitle(defaultTitle);
    setTaxId("");
    setInvoiceType("ordinary");
    setEmail("");
    setPhone(client?.phone ?? "");
    setAddress(client?.location ?? "");
    setBankName("");
    setBankAccount("");
    setRemark(transaction?.orderTitle ? `项目：${transaction.orderTitle}` : "");
  }, [open, client, transaction, existingInvoice]);

  const handleSubmit = async () => {
    if (!transaction || issued) return;
    setSubmitting(true);
    setError(null);
    try {
      const invoice = await createInvoiceRequest({
        walletTransactionId: transaction.id,
        title,
        taxId,
        invoiceType,
        email,
        phone: phone || undefined,
        address: address || undefined,
        bankName: bankName || undefined,
        bankAccount: bankAccount || undefined,
        remark: remark || undefined,
      });
      setIssued(invoice);
      onIssued?.(invoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "开票失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!transaction) return null;

  const amount = Math.abs(transaction.amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{issued ? "电子发票详情" : "开具电子发票"}</DialogTitle>
          <DialogDescription>
            {issued
              ? "发票已自动生成，电子票将发送至您填写的邮箱。"
              : "填写开票信息后，系统将自动为您开具电子发票。"}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-ink-20 bg-ink-5/40 p-3 text-sm">
          <div className="font-medium text-ink">{transaction.note}</div>
          {transaction.orderTitle ? (
            <div className="mt-1 text-xs text-ink-60">{transaction.orderTitle}</div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-60">
              {formatDateTime(transaction.occurredAt)}
            </span>
            <span className="text-base font-semibold tabular-nums text-ink">
              {formatCurrency(amount)}
            </span>
          </div>
        </div>

        {issued ? (
          <IssuedInvoiceView invoice={issued} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>发票类型</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { v: "ordinary" as const, l: "电子普通发票" },
                    { v: "special" as const, l: "电子专用发票" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setInvoiceType(opt.v)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      invoiceType === opt.v
                        ? "border-ink bg-ink text-white"
                        : "border-ink-20 text-ink-60 hover:border-ink/40",
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-title">发票抬头 *</Label>
              <Input
                id="invoice-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="个人姓名或企业全称"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-tax-id">纳税人识别号 *</Label>
              <Input
                id="invoice-tax-id"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="身份证号或统一社会信用代码"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-email">接收邮箱 *</Label>
              <Input
                id="invoice-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="用于接收电子发票"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-phone">联系电话</Label>
              <Input
                id="invoice-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="选填"
              />
            </div>

            {invoiceType === "special" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="invoice-address">注册地址 *</Label>
                  <Input
                    id="invoice-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice-bank">开户银行 *</Label>
                    <Input
                      id="invoice-bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice-account">银行账号 *</Label>
                    <Input
                      id="invoice-account"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="invoice-remark">备注</Label>
              <Textarea
                id="invoice-remark"
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="选填，如项目名称"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button
              variant="brand"
              className="w-full gap-2"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              确认并自动开票
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IssuedInvoiceView({ invoice }: { invoice: InvoiceRequest }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        电子发票已开具，将发送至 {invoice.email}
      </div>

      <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-60">发票号码</span>
          <Badge variant="brand" className="font-mono text-xs">
            {invoice.invoiceNo}
          </Badge>
        </div>
        <Row label="发票类型" value={invoiceTypeLabel(invoice.invoiceType)} />
        <Row label="发票抬头" value={invoice.title} />
        <Row label="纳税人识别号" value={invoice.taxId} />
        <Row label="开票金额" value={formatCurrency(invoice.amount)} />
        <Row label="付款说明" value={invoice.paymentNote} />
        <Row label="开具时间" value={formatDateTime(invoice.issuedAt)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <span className="text-ink-60">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-ink">{value}</span>
    </div>
  );
}
