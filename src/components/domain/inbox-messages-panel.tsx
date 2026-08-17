"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchInboxMessages,
  markAllInboxReadRequest,
  markInboxMessageReadRequest,
  type InboxMessageDTO,
} from "@/lib/api-client";
import { notifyInboxChanged } from "@/lib/use-inbox-unread";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Mail, MailOpen } from "lucide-react";

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
                    {m.linkHref ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
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
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
