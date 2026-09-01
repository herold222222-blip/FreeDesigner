"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBounties } from "@/lib/use-data";
import { BountyCard } from "@/components/domain/bounty-card";
import {
  BountyFiltersPanel,
  createDefaultBountyFilters,
} from "@/components/domain/bounty-filters-panel";
import { filterBounties } from "@/lib/bounty-filters";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Megaphone, PlusCircle } from "lucide-react";
import { parseDesignerBountiesReturnTo } from "@/lib/admin-return-to";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import { canPublishEntrust } from "@/lib/publish-access";
import { formatCurrency } from "@/lib/utils";
import type { Bounty } from "@/lib/types";
import { useRoleStore } from "@/store/role-store";
import { GuestAccessGate } from "@/components/domain/guest-access-gate";
import { splitBountiesForHall } from "@/lib/bounty-hall-privacy";

function BountySection({
  title,
  count,
  bounties,
  emptyHint,
}: {
  title: string;
  count: number;
  bounties: Bounty[];
  emptyHint: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <span className="text-xs text-ink-40">{count} 条</span>
      </div>
      {bounties.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-60">
          {emptyHint}
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {bounties.map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function BountiesPage() {
  return (
    <GuestAccessGate intent="browse">
      <Suspense>
        <BountiesInner />
      </Suspense>
    </GuestAccessGate>
  );
}

function BountiesInner() {
  const [filters, setFilters] = useState(createDefaultBountyFilters);
  const { data: bounties } = useBounties();
  const role = useRoleStore((s) => s.role);
  const showPublish = canPublishEntrust(role);
  const searchParams = useSearchParams();
  const designerReturnTo = parseDesignerBountiesReturnTo(
    searchParams.get("returnTo"),
  );
  const backHref =
    designerReturnTo ?? (role === "designer" ? "/designer/bounties" : null);

  const filtered = useMemo(
    () => filterBounties(bounties, filters),
    [bounties, filters],
  );

  const { open, awarded } = useMemo(
    () => splitBountiesForHall(filtered),
    [filtered],
  );

  const totalReward = bounties
    .filter((b) => b.status === "open")
    .reduce((sum, b) => sum + b.reward, 0);

  return (
    <div className="container-page py-6 sm:py-10">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回悬赏订单
        </Link>
      ) : null}
      <Card className="mb-8 overflow-hidden bg-ink p-8 text-white">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge className="mb-3 bg-brand/20 text-white">
              <Megaphone className="h-3 w-3" /> 悬赏大厅
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              公开招标 · 设计师主动报名
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              对设计师人选还没有明确想法?发布悬赏让符合专业的设计师主动来报名,
              你从中筛选合作。支持按一/二/三级专业与省份或城市筛选。
            </p>
          </div>
          {showPublish ? (
            <Button asChild size="lg" variant="brand">
              <Link href="/entrust/new?mode=bounty">
                <PlusCircle className="h-4 w-4" /> 发布悬赏项目
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              {bounties.filter((b) => b.status === "open").length}
            </div>
            <div className="text-xs text-white/60">开放中的悬赏</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              {formatCurrency(totalReward)}
            </div>
            <div className="text-xs text-white/60">悬赏奖池总额</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              {bounties.reduce((sum, b) => sum + bountyApplicantCount(b), 0)}
            </div>
            <div className="text-xs text-white/60">设计师累计报名次数</div>
          </div>
        </div>
      </Card>

      <BountyFiltersPanel
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(createDefaultBountyFilters())}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <Card className="p-16 text-center text-ink-60">
          没有符合筛选条件的悬赏，请放宽专业、地区或状态条件。
        </Card>
      ) : (
        <div className="space-y-10">
          {open.length > 0 ? (
            <BountySection
              title="正在报名"
              count={open.length}
              bounties={open}
              emptyHint="当前筛选下暂无正在报名的悬赏。"
            />
          ) : null}
          {awarded.length > 0 ? (
            <BountySection
              title="已选定设计师"
              count={awarded.length}
              bounties={awarded}
              emptyHint="当前筛选下暂无已选定设计师的悬赏。"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
