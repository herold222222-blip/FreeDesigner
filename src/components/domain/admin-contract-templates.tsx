"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveContractTemplatesRequest } from "@/lib/api-client";
import {
  CONTRACT_TEMPLATE_CATEGORIES,
  contractTemplateCategoryLabel,
  type ContractTemplate,
  type ContractTemplateCategory,
  type ContractTemplatesConfig,
} from "@/lib/contract-templates";
import { useContractTemplates } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { cn, formatDateTime } from "@/lib/utils";
import { FileSignature, Pencil, Search } from "lucide-react";

export function AdminContractTemplates() {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: config, refresh } = useContractTemplates();
  const [draft, setDraft] = useState<ContractTemplatesConfig>(config);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    ContractTemplateCategory | "all"
  >("all");
  const [editTarget, setEditTarget] = useState<ContractTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...draft.templates]
      .sort((a, b) => a.order - b.order)
      .filter((t) => {
        if (categoryFilter !== "all" && t.category !== categoryFilter) {
          return false;
        }
        if (!q) return true;
        return [t.name, t.description, t.content]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [draft.templates, query, categoryFilter]);

  const openEdit = (template: ContractTemplate) => {
    setEditTarget({ ...template });
  };

  const saveTemplate = async () => {
    if (!editTarget) return;
    const next = {
      templates: draft.templates.map((t) =>
        t.id === editTarget.id ? editTarget : t,
      ),
    };
    setSaving(true);
    try {
      await saveContractTemplatesRequest(next);
      setDraft(next);
      setEditTarget(null);
      push({ title: "合同模板已保存", variant: "success" });
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "保存失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (template: ContractTemplate) => {
    const next = {
      templates: draft.templates.map((t) =>
        t.id === template.id ? { ...t, enabled: !t.enabled } : t,
      ),
    };
    try {
      await saveContractTemplatesRequest(next);
      setDraft(next);
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模板名称、说明或正文"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              categoryFilter === "all"
                ? "border-ink bg-ink text-white"
                : "border-ink-20 text-ink-60",
            )}
          >
            全部分类
          </button>
          {CONTRACT_TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategoryFilter(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                categoryFilter === c.key
                  ? "border-ink bg-ink text-white"
                  : "border-ink-20 text-ink-60",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((template) => (
          <Card key={template.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-20/40">
                  <FileSignature className="h-5 w-5 text-ink-60" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-ink">
                      {template.name}
                    </h4>
                    <Badge variant={template.enabled ? "emerald" : "muted"}>
                      {template.enabled ? "已启用" : "已停用"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-60">
                    {contractTemplateCategoryLabel(template.category)} · 更新{" "}
                    {formatDateTime(template.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 flex-1 text-sm text-ink-60 line-clamp-2">
              {template.description}
            </p>
            <pre className="mt-3 max-h-28 overflow-hidden rounded-md bg-ink-20/20 p-3 text-[11px] leading-relaxed text-ink-60 line-clamp-5 whitespace-pre-wrap">
              {template.content}
            </pre>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                <Pencil className="h-3.5 w-3.5" />
                编辑模板
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleEnabled(template)}
              >
                {template.enabled ? "停用" : "启用"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-60">
          没有符合筛选条件的合同模板。
        </Card>
      ) : null}

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑合同模板</DialogTitle>
            <DialogDescription>
              支持 {"{{变量名}}"} 占位符，下单或签约时由系统自动填充。
            </DialogDescription>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>模板名称</Label>
                <Input
                  value={editTarget.name}
                  onChange={(e) =>
                    setEditTarget({ ...editTarget, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>说明</Label>
                <Input
                  value={editTarget.description}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>合同正文</Label>
                <Textarea
                  value={editTarget.content}
                  onChange={(e) =>
                    setEditTarget({ ...editTarget, content: e.target.value })
                  }
                  rows={16}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              取消
            </Button>
            <Button variant="brand" disabled={saving} onClick={saveTemplate}>
              {saving ? "保存中…" : "保存模板"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
