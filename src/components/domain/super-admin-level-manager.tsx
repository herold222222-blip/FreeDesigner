"use client";

import { useEffect, useState } from "react";
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
  migrateLevelUsersRequest,
  saveLevelManagementRequest,
} from "@/lib/api-client";
import {
  createEmptyManagedLevel,
  INTERN_PROMOTION_LABEL,
  isInternLevel,
  LEVEL_CATEGORIES,
  parseFeeRatePercent,
  PROMOTION_MODE_LABELS,
  type LevelCategory,
  type LevelManagementConfig,
  type ManagedLevel,
  type PromotionMode,
} from "@/lib/level-management";
import { useLevelManagement, useLevelManagementStats } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";
import { BarChart3, Plus, Trash2, TrendingUp } from "lucide-react";

type DeleteLevelTarget = {
  category: LevelCategory;
  level: ManagedLevel;
  userCount: number;
};

export function SuperAdminLevelManager() {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: config, refresh: refreshConfig } = useLevelManagement();
  const { data: stats, refresh: refreshStats } = useLevelManagementStats();
  const [draft, setDraft] = useState<LevelManagementConfig>(config);
  const [activeCategory, setActiveCategory] =
    useState<LevelCategory>("design_subject");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteLevelTarget | null>(
    null,
  );
  const [migrateToLevelId, setMigrateToLevelId] = useState("");

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const getLevelUserCount = (category: LevelCategory, levelId: string) =>
    stats
      .find((item) => item.category === category)
      ?.levels.find((entry) => entry.levelId === levelId)?.count ?? 0;

  const updateLevel = (
    category: LevelCategory,
    levelId: string,
    patch: Partial<ManagedLevel>,
  ) => {
    setDraft((current) => ({
      ...current,
      [category]: current[category].map((level) =>
        level.id === levelId ? { ...level, ...patch } : level,
      ),
    }));
  };

  const addLevel = (category: LevelCategory) => {
    const nextOrder = draft[category].length + 1;
    const next = createEmptyManagedLevel(category, nextOrder);
    setDraft((current) => ({
      ...current,
      [category]: [...current[category], next],
    }));
  };

  const removeLevelFromDraft = (category: LevelCategory, levelId: string) => {
    setDraft((current) => ({
      ...current,
      [category]: current[category]
        .filter((level) => level.id !== levelId)
        .map((level, index) => ({ ...level, order: index + 1 })),
    }));
  };

  const requestDeleteLevel = (category: LevelCategory, levelId: string) => {
    if (draft[category].length <= 1) return;

    const userCount = getLevelUserCount(category, levelId);
    const level = draft[category].find((item) => item.id === levelId);
    if (!level) return;

    if (userCount > 0) {
      const fallback = draft[category].find((item) => item.id !== levelId);
      setMigrateToLevelId(fallback?.id ?? "");
      setDeleteTarget({ category, level, userCount });
      return;
    }

    removeLevelFromDraft(category, levelId);
  };

  const confirmDeleteLevel = async () => {
    if (!deleteTarget) return;
    if (!migrateToLevelId) {
      push({
        title: "请选择转入等级",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (deleteTarget.userCount > 0) {
        const result = await migrateLevelUsersRequest({
          category: deleteTarget.category,
          fromLevelId: deleteTarget.level.id,
          toLevelId: migrateToLevelId,
        });
        push({
          title: `已迁移 ${result.migrated} 位用户`,
          description: `「${deleteTarget.level.name}」下的用户已转入目标等级。`,
          variant: "success",
        });
      }
      removeLevelFromDraft(deleteTarget.category, deleteTarget.level.id);
      setDeleteTarget(null);
      setMigrateToLevelId("");
      refreshStats();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "删除失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveLevelManagementRequest(draft);
      push({
        title: "等级配置已保存",
        description: "设计主体与委托人的等级规则已更新。",
        variant: "success",
      });
      refreshConfig();
      refreshStats();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "保存失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const migrationOptions = deleteTarget
    ? draft[deleteTarget.category].filter(
        (level) => level.id !== deleteTarget.level.id,
      )
    : [];

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-ink-60" />
          <h3 className="text-base font-semibold text-ink">等级用户统计</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map((item) => (
            <div
              key={item.category}
              className="rounded-xl border border-ink-20 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {item.categoryLabel}
                </span>
                <Badge variant="muted">共 {item.total} 人</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {item.levels.length === 0 ? (
                  <p className="text-xs text-ink-40">暂无等级配置</p>
                ) : (
                  item.levels.map((level) => (
                    <div
                      key={level.levelId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-ink-60">{level.levelName}</span>
                      <span className="font-medium tabular-nums text-ink">
                        {level.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">等级规则配置</h3>
            <p className="mt-1 text-xs text-ink-60">
              分为设计主体与委托人两大类；配置晋级条件、限制权限、费率及提现/付款规则。
            </p>
          </div>
          <Button variant="brand" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存全部配置"}
          </Button>
        </div>

        <Tabs
          value={activeCategory}
          onValueChange={(value) => setActiveCategory(value as LevelCategory)}
        >
          <TabsList>
            {LEVEL_CATEGORIES.map((category) => (
              <TabsTrigger key={category.key} value={category.key}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {LEVEL_CATEGORIES.map((category) => (
            <TabsContent key={category.key} value={category.key}>
              <div className="mb-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addLevel(category.key)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增等级
                </Button>
              </div>
              <div className="space-y-4">
                {draft[category.key].map((level, index) => (
                  <Card key={level.id} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">等级 {index + 1}</Badge>
                        <span className="text-xs text-ink-40">ID: {level.id}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          requestDeleteLevel(category.key, level.id)
                        }
                        disabled={draft[category.key].length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>等级名称</Label>
                        <Input
                          value={level.name}
                          onChange={(e) =>
                            updateLevel(category.key, level.id, {
                              name: e.target.value,
                            })
                          }
                          placeholder="如：见习、中级v1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>晋级方式</Label>
                        {isInternLevel(level.id) ? (
                          <div className="rounded-xl border border-ink bg-ink px-3 py-2 text-sm text-white">
                            {INTERN_PROMOTION_LABEL}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {(
                              Object.entries(PROMOTION_MODE_LABELS) as [
                                PromotionMode,
                                string,
                              ][]
                            ).map(([mode, label]) => {
                              const active = level.promotionMode === mode;
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() =>
                                    updateLevel(category.key, level.id, {
                                      promotionMode: mode,
                                    })
                                  }
                                  className={cn(
                                    "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors",
                                    active
                                      ? "border-ink bg-ink text-white"
                                      : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>达到条件</Label>
                      <Textarea
                        rows={2}
                        value={level.condition}
                        onChange={(e) =>
                          updateLevel(category.key, level.id, {
                            condition: e.target.value,
                          })
                        }
                        placeholder="描述晋升到该等级的条件，如完成订单数、好评率、年消费额等"
                      />
                    </div>

                    <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4 space-y-4">
                      <p className="text-xs font-semibold text-ink-60">
                        限制与权益说明
                      </p>

                      <div className="space-y-2">
                        <Label>限制条件 / 权限说明</Label>
                        <Textarea
                          rows={2}
                          value={level.restrictions}
                          onChange={(e) =>
                            updateLevel(category.key, level.id, {
                              restrictions: e.target.value,
                            })
                          }
                          placeholder="如接单上限、展示优先级、发布权限等"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          {category.kind === "designer" ? "取费费率" : "费率"}
                        </Label>
                        <div className="relative max-w-[200px]">
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            step={1}
                            inputMode="numeric"
                            className="pr-9"
                            value={level.feeRate}
                            onChange={(e) => {
                              const next = parseFeeRatePercent(
                                e.target.value,
                                level.feeRate,
                              );
                              updateLevel(category.key, level.id, {
                                feeRate: next,
                              });
                            }}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-40">
                            %
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-40">
                          {category.kind === "designer"
                            ? "与费用计算器设计师等级系数一致，100 表示标准取费（仅可修改数字）。"
                            : "与费用计算器客户等级系数一致，100 表示标准费率（仅可修改数字）。"}
                        </p>
                      </div>

                      {category.kind === "designer" ? (
                        <div className="space-y-2">
                          <Label>提现条件</Label>
                          <Textarea
                            rows={2}
                            value={level.withdrawCondition ?? ""}
                            onChange={(e) =>
                              updateLevel(category.key, level.id, {
                                withdrawCondition: e.target.value,
                              })
                            }
                            placeholder="如冻结周期、手续费扣除、提现门槛等"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>付款条件</Label>
                            <Textarea
                              rows={2}
                              value={level.paymentCondition ?? ""}
                              onChange={(e) =>
                                updateLevel(category.key, level.id, {
                                  paymentCondition: e.target.value,
                                })
                              }
                              placeholder="如延期支付期限、预付要求、托管规则等"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>其他特权</Label>
                            <Textarea
                              rows={2}
                              value={level.privileges ?? ""}
                              onChange={(e) =>
                                updateLevel(category.key, level.id, {
                                  privileges: e.target.value,
                                })
                              }
                              placeholder="如背靠背合同、专属客服、账单汇总等"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-ink-40">
                      <TrendingUp className="h-3.5 w-3.5" />
                      当前该等级用户：
                      <span className="font-medium text-ink">
                        {getLevelUserCount(category.key, level.id)}
                      </span>
                      人
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setMigrateToLevelId("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除等级并迁移用户</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `「${deleteTarget.level.name}」下现有 ${deleteTarget.userCount} 位用户，删除前请选择转入的目标等级。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="migrate-level">转入等级</Label>
            <select
              id="migrate-level"
              value={migrateToLevelId}
              onChange={(e) => setMigrateToLevelId(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-ink-20 bg-background px-3 text-sm text-ink"
            >
              {migrationOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setMigrateToLevelId("");
              }}
            >
              取消
            </Button>
            <Button variant="brand" onClick={confirmDeleteLevel} disabled={saving}>
              {saving ? "处理中…" : "确认删除并迁移"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
