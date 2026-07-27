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
import { canPublishEntrust } from "@/lib/publish-access";
import { formatCurrency } from "@/lib/utils";
import type { Bounty } from "@/lib/types";
import { useRoleStore } from "@/store/role-store";
import { GuestAccessGate } from "@/components/domain/guest-access-gate";

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
      <BountiesInner />
    </GuestAccessGate>
  );
}

function BountiesInner() {
  const [filters, setFilters] = useState(createDefaultBountyFilters);
  const { data: bounties } = useBounties();
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const showPublish = canPublishEntrust(role);
  const isClient = role === "client" && Boolean(identityId);

  const filtered = useMemo(
    () => filterBounties(bounties, filters),
    [bounties, filters],
  );

  const { mine, others } = useMemo(() => {
    if (!isClient) {
      return { mine: [] as Bounty[], others: filtered };
    }
    const mineList: Bounty[] = [];
    const otherList: Bounty[] = [];
    for (const b of filtered) {
      if (b.publisherId === identityId) mineList.push(b);
      else otherList.push(b);
    }
    return { mine: mineList, others: otherList };
  }, [filtered, identityId, isClient]);

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

      {isClient ? (
        <div className="space-y-10">
          <BountySection
            title="我的委托"
            count={mine.length}
            bounties={mine}
            emptyHint="当前筛选下暂无您发布的悬赏。"
          />
          <BountySection
            title="其他悬赏"
            count={others.length}
            bounties={others}
            emptyHint="当前筛选下暂无其他悬赏。"
          />
        </div>
      ) : filtered.length === 0 ? (
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
