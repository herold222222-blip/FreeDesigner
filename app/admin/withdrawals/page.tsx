"use client";

import { AdminWithdrawalQueue } from "@/components/domain/admin-withdrawal-queue";
import { useWithdrawalRequests } from "@/lib/use-data";

export default function AdminWithdrawalsPage() {
  const { data: requests } = useWithdrawalRequests();
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          提现审批
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          处理个人设计师、设计团队与设计公司的提现申请，审批通过后由财务打款。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="待审批" value={pendingCount} />
        <StatCard
          label="个人设计师"
          value={
            requests.filter(
              (r) => r.subjectType === "individual" && r.status === "pending",
            ).length
          }
        />
        <StatCard
          label="团队 / 公司"
          value={
            requests.filter(
              (r) =>
                (r.subjectType === "team" || r.subjectType === "company") &&
                r.status === "pending",
            ).length
          }
        />
      </div>

      <AdminWithdrawalQueue />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-20 bg-background p-5">
      <div className="text-xs uppercase tracking-wider text-ink-40">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
