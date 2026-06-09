import Link from "next/link";
import { getBounty, listDesigners } from "@/lib/server/repo";
import { getSessionUser } from "@/lib/server/auth";
import {
  bountyApplicantCount,
  canViewBountyApplicantDetailsInPublicHall,
} from "@/lib/bounty-privacy";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BountyApplicantList } from "@/components/domain/bounty-applicant-list";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import {
  CalendarDays,
  Coins,
  Download,
  FileBox,
  MapPin,
  Users,
} from "lucide-react";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import { formatBountyReward, formatDate, formatDateTime } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function BountyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [bounty, allDesigners, session] = await Promise.all([
    getBounty(params.id),
    listDesigners(),
    getSessionUser(),
  ]);
  if (!bounty) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        未找到该悬赏。
      </div>
    );
  }

  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  const applicantCount = bountyApplicantCount(bounty);
  const showApplicantDetails =
    canViewBountyApplicantDetailsInPublicHall(session);

  return (
    <div className="container-page py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-8">
            <div className="flex flex-wrap items-center gap-2">
              <SpecialtyBadge specialty={bounty.specialty} />
              <Badge variant="muted">{trackLabels.l1}</Badge>
              {trackLabels.l2 ? (
                <Badge variant="outline" className="text-[10px]">
                  二级 · {trackLabels.l2}
                </Badge>
              ) : null}
              {trackLabels.l3 ? (
                <Badge variant="outline" className="text-[10px]">
                  三级 · {trackLabels.l3}
                </Badge>
              ) : null}
              {bounty.status === "open" && (
                <Badge variant="emerald">开放报名</Badge>
              )}
              {bounty.status === "paused" && (
                <Badge variant="amber">已暂停报名</Badge>
              )}
              {bounty.status === "in_review" && (
                <Badge variant="amber">审核中</Badge>
              )}
              <span className="text-xs text-ink-40">{bounty.code}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {bounty.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-60">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {bounty.location.label}
              </span>
              {bounty.projectType ? (
                <span>类型 · {bounty.projectType}</span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> 成果提交{" "}
                {formatDate(bounty.deadline)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {applicantCount} 位设计师报名
              </span>
              <span>发布于 {formatDateTime(bounty.publishedAt)}</span>
            </div>
            <Separator className="my-6" />
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-40">
                项目描述
              </div>
              <p className="text-sm leading-relaxed text-ink-80">
                {bounty.description}
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-40">
                服务要求
              </div>
              <ul className="space-y-2 text-sm text-ink-60">
                {bounty.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-40" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-40">
                项目附件
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {bounty.attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileBox className="h-4 w-4 text-ink-60" />
                      <div className="text-sm font-medium text-ink">{a.name}</div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Download className="h-3.5 w-3.5" /> 下载
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                报名情况
              </h2>
              <p className="mt-1 text-sm text-ink-60">
                已有 <strong className="text-ink">{applicantCount}</strong>{" "}
                位设计师报名
              </p>
            </div>
            {showApplicantDetails ? (
              <BountyApplicantList bounty={bounty} designers={allDesigners} />
            ) : (
              <div className="rounded-xl border border-ink-20 bg-ink-20/15 p-5 text-sm text-ink-60">
                <p>
                  悬赏大厅仅展示报名人数，不公开报名设计师的具体资料与报价。
                </p>
                <p className="mt-2">
                  若你是本项目发布方，请前往
                  <Link
                    href={`/client/bounties/${bounty.id}`}
                    className="mx-1 font-medium text-brand hover:underline"
                  >
                    委托人工作台 · 我的悬赏
                  </Link>
                  查看报名详情并选择合作设计师。
                </p>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              悬赏金额
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-brand">
              {formatBountyReward(bounty.reward)}
            </div>
            <p className="mt-1 text-xs text-ink-60">
              选定设计师后资金转入平台托管
            </p>

            <Separator className="my-5" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-60">成果提交时间</span>
                <span className="font-medium text-ink">
                  {formatDate(bounty.deadline)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-60">报名设计师</span>
                <span className="font-medium text-ink">{applicantCount} 位</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-60">资料附件</span>
                <span className="font-medium text-ink">
                  {bounty.attachments.length} 份
                </span>
              </div>
            </div>

            {session?.role === "client" ? (
              <div className="mt-6 rounded-xl border border-ink-20 bg-ink-20/15 p-4 text-sm leading-relaxed text-ink-60">
                当前为委托人身份，如需报名，需要切换为设计身份。
              </div>
            ) : (
              <Button asChild variant="brand" size="lg" className="mt-6 w-full">
                <Link href={`/login?role=designer`}>
                  <Coins className="h-4 w-4" /> 我是设计师 · 立即报名
                </Link>
              </Button>
            )}
          </Card>

          <Card className="p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              悬赏发布方
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                禹
              </div>
              <div>
                <div className="text-sm font-medium text-ink">禹生文旅产业</div>
                <div className="text-xs text-ink-60">企业认证 · 已合作 14 个项目</div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
