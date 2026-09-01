"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteAllInboxMessagesRequest,
  deleteInboxMessageRequest,
  fetchInboxMessages,
  markAllInboxReadRequest,
  markInboxMessageReadRequest,
  type InboxMessageDTO,
} from "@/lib/api-client";
import { notifyInboxChanged } from "@/lib/use-inbox-unread";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CheckCheck, Mail, MailOpen, Trash2 } from "lucide-react";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function InboxMessagesPanel() {
  const [messages, setMessages] = useState<InboxMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { type: "one"; id: string; title: string } | { type: "all" } | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { messages: list } = await fetchInboxMessages();
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = messages.filter((m) => m.unread).length;

  const markRead = async (id: string) => {
    setMessages((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target?.unread) return prev;
      return prev.map((m) =>
        m.id === id
          ? { ...m, unread: false, readAt: m.readAt ?? new Date().toISOString() }
          : m,
      );
    });
    try {
      await markInboxMessageReadRequest(id);
      notifyInboxChanged();
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    if (markingAll || unread === 0) return;
    setMarkingAll(true);
    try {
      await markAllInboxReadRequest();
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          unread: false,
          readAt: m.readAt ?? new Date().toISOString(),
        })),
      );
      notifyInboxChanged();
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "one") {
      const id = pendingDelete.id;
      if (deletingId) return;
      setDeletingId(id);
      const prev = messages;
      setMessages((list) => list.filter((m) => m.id !== id));
      try {
        await deleteInboxMessageRequest(id);
        notifyInboxChanged();
        setPendingDelete(null);
      } catch {
        setMessages(prev);
      } finally {
        setDeletingId(null);
      }
      return;
    }
    if (clearing || messages.length === 0) return;
    setClearing(true);
    const prev = messages;
    setMessages([]);
    try {
      await deleteAllInboxMessagesRequest();
      notifyInboxChanged();
      setPendingDelete(null);
    } catch {
      setMessages(prev);
    } finally {
      setClearing(false);
    }
  };

  const deleteBusy = Boolean(deletingId) || clearing;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <Bell className="h-6 w-6 text-brand" />
            消息
            {unread > 0 ? (
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-sm font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-ink-60">
            含支付、成果确认、返修、等级提升等系统通知，以及其他用户消息。未读数会在侧栏与顶部铃铛同步显示。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={unread === 0 || markingAll}
            onClick={markAll}
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? "处理中…" : "全部标为已读"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={messages.length === 0 || clearing}
            onClick={() => setPendingDelete({ type: "all" })}
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? "删除中…" : "清空全部"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-ink-60">加载中…</Card>
      ) : messages.length === 0 ? (
        <Card className="p-16 text-center text-sm text-ink-60">
          暂无消息。系统审核结果、客服回复等会在此出现。
        </Card>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id}>
              <Card
                className={cn(
                  "p-4 transition-colors",
                  m.unread && "cursor-pointer border-brand/40 bg-brand/[0.04]",
                )}
                onClick={() => {
                  if (m.unread) void markRead(m.id);
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      m.unread
                        ? "bg-brand text-white"
                        : "bg-ink-20/50 text-ink-60",
                    )}
                  >
                    {m.unread ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MailOpen className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.linkHref ? (
                        <Link
                          href={m.linkHref}
                          className={cn(
                            "text-sm font-semibold text-ink hover:underline",
                            m.unread && "text-brand",
                          )}
                          onClick={() => {
                            if (m.unread) void markRead(m.id);
                          }}
                        >
                          {m.title}
                        </Link>
                      ) : (
                        <h2
                          className={cn(
                            "text-sm font-semibold text-ink",
                            m.unread && "text-brand",
                          )}
                        >
                          {m.title}
                        </h2>
                      )}
                      {m.unread ? (
                        <Badge className="bg-brand text-white hover:bg-brand">
                          未读
                        </Badge>
                      ) : null}
                      <Badge variant="muted">
                        {m.kind === "system" ? "系统" : "用户"}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-40">
                      {m.fromName} · {formatTime(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-80">
                      {m.body}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {m.linkHref ? (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={m.linkHref}
                            onClick={() => {
                              if (m.unread) void markRead(m.id);
                            }}
                          >
                            查看详情
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete({
                            type: "one",
                            id: m.id,
                            title: m.title,
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === m.id ? "删除中…" : "删除"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (deleteBusy) return;
          if (!next) setPendingDelete(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="pt-1">
                {pendingDelete?.type === "all" ? "确认清空全部消息？" : "确认删除这条消息？"}
              </span>
            </DialogTitle>
            <DialogDescription className="pl-[2.625rem] text-sm leading-relaxed text-ink-60">
              {pendingDelete?.type === "all"
                ? `即将删除全部 ${messages.length} 条消息。删除后不可恢复。`
                : `即将删除「${pendingDelete?.title ?? "该消息"}」。删除后不可恢复。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteBusy}
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="brand"
              className="bg-rose-600 hover:bg-rose-700"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
