"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  savePlatformContentRequest,
  updateFeedbackRequest,
} from "@/lib/api-client";
import {
  ONBOARDING_AGREEMENT_AUDIENCES,
  type FaqItem,
  type OnboardingAgreementAudience,
  type PlatformContentConfig,
} from "@/lib/platform-content";
import { useFeedbackMessages, usePlatformContent } from "@/lib/use-data";
import type { FeedbackMessage } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import { cn, formatDateTime } from "@/lib/utils";
import {
  FileText,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const FEEDBACK_STATUS_LABELS: Record<FeedbackMessage["status"], string> = {
  pending: "待处理",
  replied: "已回复",
  closed: "已关闭",
};

const AUDIENCE_LABELS: Record<FeedbackMessage["audience"], string> = {
  client: "委托人",
  designer: "设计师",
};

export function AdminContentManager() {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: content, refresh: refreshContent } = usePlatformContent();
  const { data: feedbackList, refresh: refreshFeedback } = useFeedbackMessages();
  const [draft, setDraft] = useState<PlatformContentConfig>(content);
  const [agreementAudience, setAgreementAudience] =
    useState<OnboardingAgreementAudience>("designer_individual");
  const [feedbackQuery, setFeedbackQuery] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<
    "all" | FeedbackMessage["status"]
  >("all");
  const [replyTarget, setReplyTarget] = useState<FeedbackMessage | null>(null);
  const [replyNote, setReplyNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  const filteredFeedback = useMemo(() => {
    const keyword = feedbackQuery.trim().toLowerCase();
    return feedbackList.filter((item) => {
      if (feedbackStatus !== "all" && item.status !== feedbackStatus) {
        return false;
      }
      if (!keyword) return true;
      const haystack = [
        item.userName,
        item.phone ?? "",
        item.message,
        item.replyNote ?? "",
        AUDIENCE_LABELS[item.audience],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [feedbackList, feedbackQuery, feedbackStatus]);

  const pendingCount = feedbackList.filter((f) => f.status === "pending").length;

  const saveContent = async () => {
    setSaving(true);
    try {
      await savePlatformContentRequest(draft);
      push({
        title: "内容已保存",
        description: "常见问题、入驻协议与关于我们已更新。",
        variant: "success",
      });
      refreshContent();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "保存失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addFaq = () => {
    const next: FaqItem = {
      id: `faq_${Date.now()}`,
      question: "",
      answer: "",
      enabled: true,
      order: draft.faqs.length + 1,
    };
    setDraft((d) => ({ ...d, faqs: [...d.faqs, next] }));
  };

  const updateFaq = (id: string, patch: Partial<FaqItem>) => {
    setDraft((d) => ({
      ...d,
      faqs: d.faqs.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeFaq = (id: string) => {
    setDraft((d) => ({ ...d, faqs: d.faqs.filter((item) => item.id !== id) }));
  };

  const submitReply = async () => {
    if (!replyTarget) return;
    try {
      await updateFeedbackRequest(replyTarget.id, {
        status: "replied",
        replyNote: replyNote.trim() || undefined,
      });
      push({
        title: "已标记为已回复",
        description: `${replyTarget.userName} 的留言已处理。`,
        variant: "success",
      });
      setReplyTarget(null);
      setReplyNote("");
      refreshFeedback();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList>
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="h-3.5 w-3.5" />
            常见问题
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            意见反馈
            <Badge variant="muted">{pendingCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="agreements" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            入驻协议
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            关于我们
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faq">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">常见问题</h3>
                <p className="mt-1 text-xs text-ink-60">
                  维护平台对外展示的 FAQ 条目。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addFaq}>
                <Plus className="h-3.5 w-3.5" />
                新增问题
              </Button>
            </div>
            <div className="space-y-4">
              {draft.faqs.map((item, index) => (
                <Card key={item.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-40">
                      问题 {index + 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFaq(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>问题</Label>
                    <Input
                      value={item.question}
                      onChange={(e) =>
                        updateFaq(item.id, { question: e.target.value })
                      }
                      placeholder="请输入常见问题标题"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>回答</Label>
                    <Textarea
                      rows={3}
                      value={item.answer}
                      onChange={(e) =>
                        updateFaq(item.id, { answer: e.target.value })
                      }
                      placeholder="请输入回答内容"
                    />
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="brand" onClick={saveContent} disabled={saving}>
                保存常见问题
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">意见反馈</h3>
              <p className="mt-1 text-xs text-ink-60">
                来自设计师与委托人「联系客服 · 在线留言」的反馈列表。
              </p>
            </div>

            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
                <Input
                  value={feedbackQuery}
                  onChange={(e) => setFeedbackQuery(e.target.value)}
                  placeholder="搜索姓名、手机号、留言内容"
                  className="h-11 pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "all", label: "全部" },
                    { value: "pending", label: "待处理" },
                    { value: "replied", label: "已回复" },
                    { value: "closed", label: "已关闭" },
                  ] as const
                ).map((item) => {
                  const active = feedbackStatus === item.value;
                  const count =
                    item.value === "all"
                      ? feedbackList.length
                      : feedbackList.filter((f) => f.status === item.value).length;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFeedbackStatus(item.value)}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
                      )}
                    >
                      {item.label}
                      <span
                        className={cn(
                          "ml-1.5 tabular-nums",
                          active ? "text-white/80" : "text-ink-40",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {filteredFeedback.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-20 p-8 text-center text-sm text-ink-40">
                  暂无符合筛选条件的留言。
                </div>
              ) : (
                filteredFeedback.map((item) => (
                  <Card key={item.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              item.status === "pending"
                                ? "amber"
                                : item.status === "replied"
                                  ? "emerald"
                                  : "muted"
                            }
                          >
                            {FEEDBACK_STATUS_LABELS[item.status]}
                          </Badge>
                          <Badge variant="muted">
                            {AUDIENCE_LABELS[item.audience]}
                          </Badge>
                          <span className="text-sm font-semibold text-ink">
                            {item.userName}
                          </span>
                          {item.phone ? (
                            <span className="text-xs text-ink-40">{item.phone}</span>
                          ) : null}
                          <span className="text-xs text-ink-40">
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-ink-80">
                          {item.message}
                        </p>
                        {item.replyNote ? (
                          <p className="rounded-lg bg-ink-20/30 px-3 py-2 text-xs text-ink-60">
                            处理备注：{item.replyNote}
                          </p>
                        ) : null}
                      </div>
                      {item.status === "pending" ? (
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={() => {
                            setReplyTarget(item);
                            setReplyNote("");
                          }}
                        >
                          标记已回复
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="agreements">
          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">入驻协议</h3>
              <p className="mt-1 text-xs text-ink-60">
                按不同用户类型分别维护入驻 / 服务协议正文。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_AGREEMENT_AUDIENCES.map((item) => {
                const active = agreementAudience === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setAgreementAudience(item.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>
                {
                  ONBOARDING_AGREEMENT_AUDIENCES.find(
                    (a) => a.key === agreementAudience,
                  )?.label
                }
                协议
              </Label>
              <Textarea
                rows={14}
                value={draft.agreements[agreementAudience]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    agreements: {
                      ...d.agreements,
                      [agreementAudience]: e.target.value,
                    },
                  }))
                }
                placeholder="请输入协议正文"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="brand" onClick={saveContent} disabled={saving}>
                保存入驻协议
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">关于我们</h3>
              <p className="mt-1 text-xs text-ink-60">
                平台简介、使命与联系方式等对外展示内容。
              </p>
            </div>
            <Textarea
              rows={12}
              value={draft.aboutUs}
              onChange={(e) =>
                setDraft((d) => ({ ...d, aboutUs: e.target.value }))
              }
              placeholder="请输入关于我们的内容"
            />
            <div className="flex justify-end">
              <Button variant="brand" onClick={saveContent} disabled={saving}>
                保存关于我们
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!replyTarget}
        onOpenChange={(open) => !open && setReplyTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>处理留言</DialogTitle>
            <DialogDescription>
              {replyTarget
                ? `${replyTarget.userName} · ${AUDIENCE_LABELS[replyTarget.audience]}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {replyTarget ? (
            <p className="rounded-lg border border-ink-20 bg-ink-20/20 p-3 text-sm text-ink-80">
              {replyTarget.message}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="reply-note">处理备注（选填）</Label>
            <Textarea
              id="reply-note"
              rows={3}
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              placeholder="记录电话回访或站内回复摘要"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>
              取消
            </Button>
            <Button variant="brand" onClick={submitReply}>
              确认已回复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
