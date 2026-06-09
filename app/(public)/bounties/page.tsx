"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Megaphone, PlusCircle } from "lucide-react";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import { formatCurrency } from "@/lib/utils";

export default function BountiesPage() {
  const [filters, setFilters] = useState(createDefaultBountyFilters);
  const { data: bounties } = useBounties();

  const filtered = useMemo(
    () => filterBounties(bounties, filters),
    [bounties, filters],
  );

  const totalReward = bounties
    .filter((b) => b.status === "open")
    .reduce((sum, b) => sum + b.reward, 0);

  return (
    <div className="container-page py-10">
      <Card className="mb-8 overflow-hidden bg-ink p-8 text-white">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge className="mb-3 bg-brand/20 text-white">
              <Megaphone className="h-3 w-3" /> 悬赏大厅
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              公开招标 · 设计师主动报名
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              对设计师人选还没有明确想法?发布悬赏让符合专业的设计师主动来报名,
              你从中筛选合作。支持按一/二/三级专业与省份或城市筛选。
            </p>
          </div>
          <Button asChild size="lg" variant="brand">
            <Link href="/entrust/new?mode=bounty">
              <PlusCircle className="h-4 w-4" /> 发布悬赏项目
            </Link>
          </Button>
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}
    </div>
  );
}
