import Link from "next/link";
import { getBounty, getClient, listDesigners, listOrders } from "@/lib/server/repo";
import { getSessionUser } from "@/lib/server/auth";
import {
  bountyApplicantCount,
  canViewBountyApplicantDetailsInPublicHall,
  canViewBountyHallFullInfo,
  redactBountyApplicants,
} from "@/lib/bounty-privacy";
import {
  applyBountyPublicPrivacyWithContract,
  isBountyAwardedContractSigned,
} from "@/lib/server/bounty-hall-privacy";
import {
  isBountyHallAwardedGroup,
  maskPersonName,
} from "@/lib/bounty-hall-privacy";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BountyApplicantList } from "@/components/domain/bounty-applicant-list";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import {
  CalendarDays,
  Clock,
  Info,
  MapPin,
  Users,
} from "lucide-react";
import { OrderAttachmentsList } from "@/components/domain/order-attachments";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import { bountyPublicTodoHint } from "@/lib/bounty-manage";
import { formatDateTime } from "@/lib/utils";
import {
  formatBountyDeadline,
  formatBountyValidUntil,
  isBountyValidityExpired,
} from "@/lib/bounty-validity";
import { Separator } from "@/components/ui/separator";
import { GuestAccessGate } from "@/components/domain/guest-access-gate";
import { BountyPublicApplyPanel } from "@/components/domain/bounty-public-apply-panel";
import { OrderEntrustDescription } from "@/components/domain/order-entrust-description";
import { ClientLevelBadge } from "@/components/domain/level-badges";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";

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
      <GuestAccessGate intent="detail">
        <div className="container-page py-20 text-center text-ink-60">
          未找到该悬赏。
        </div>
      </GuestAccessGate>
    );
  }

  const [publisher, publisherOrders, viewBounty, contractSigned] =
    await Promise.all([
      getClient(bounty.publisherId),
      listOrders({ clientId: bounty.publisherId }),
      applyBountyPublicPrivacyWithContract(bounty, session),
      isBountyAwardedContractSigned(bounty),
    ]);
  const revealFull = canViewBountyHallFullInfo(session, bounty, contractSigned);
  const rawPublisherName =
    publisher?.companyName?.trim() || publisher?.name?.trim() || "委托人";
  const publisherName = revealFull
    ? rawPublisherName
    : maskPersonName(rawPublisherName);
  const publisherInitial = rawPublisherName.slice(0, 1);
  const publisherMeta = [
    publisher?.type === "enterprise"
      ? publisher.verified
        ? "企业认证"
        : "企业委托人"
      : "个人委托人",
    publisherOrders.length > 0
      ? `已合作 ${publisherOrders.length} 个项目`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  const applicantCount = bountyApplicantCount(bounty);
  const showApplicantDetails =
    canViewBountyApplicantDetailsInPublicHall(session);
  const alreadyApplied = Boolean(
    session?.role === "designer" &&
      session.identityId &&
      bounty.applicants.some((a) => a.designerId === session.identityId),
  );
  const viewerRole = session?.role ?? "guest";
  const todoHint = bountyPublicTodoHint({
    status: bounty.status,
    viewerRole,
    isPublisher:
      session?.role === "client" && session.identityId === bounty.publisherId,
    alreadyApplied,
    validUntil: bounty.validUntil,
  });

  return (
    <GuestAccessGate intent="detail">
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
              {bounty.status === "open" &&
                !isBountyValidityExpired(bounty.validUntil) && (
                <Badge variant="emerald">开放报名</Badge>
              )}
              {bounty.status === "open" &&
                isBountyValidityExpired(bounty.validUntil) && (
                <Badge variant="amber">已过期</Badge>
              )}
              {bounty.status === "paused" && (
                <Badge variant="amber">已暂停报名</Badge>
              )}
              {bounty.status === "in_review" && (
                <Badge variant="amber">审核中</Badge>
              )}
              {isBountyHallAwardedGroup(bounty) && (
                <Badge variant="muted">已选定设计师 · 不可报名</Badge>
              )}
              <span className="text-xs text-ink-40">{bounty.code}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {viewBounty.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-60">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {bounty.location.label}
              </span>
              {bounty.projectType ? (
                <span>类型 · {bounty.projectType}</span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> 有效期{" "}
                {formatBountyValidUntil(bounty.validUntil)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> 成果提交{" "}
                {formatBountyDeadline(bounty.deadline)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {applicantCount} 位设计师报名
              </span>
              <span>发布于 {formatDateTime(bounty.publishedAt)}</span>
            </div>
            <Separator className="my-6" />
            <OrderEntrustDescription
              description={viewBounty.description}
              primaryTrack={viewBounty.primaryTrack}
              className="space-y-4"
            />

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

            <OrderAttachmentsList attachments={bounty.attachments} />
          </Card>

          <BountyPublicApplyPanel
            bounty={redactBountyApplicants(viewBounty)}
            applicantCount={applicantCount}
            alreadyApplied={alreadyApplied}
            viewerRole={viewerRole}
          />

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
              悬赏发布方
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {revealFull && publisher?.avatar ? (
                  <AvatarImage src={publisher.avatar} alt={publisherName} />
                ) : null}
                <AvatarFallback className="bg-ink text-xs font-semibold text-white">
                  {publisherInitial}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-ink">{publisherName}</div>
                  <ClientLevelBadge
                    level={publisher?.level ?? DEFAULT_CLIENT_LEVEL}
                  />
                </div>
                <div className="text-xs text-ink-60">
                  {publisher ? publisherMeta : "发布方信息暂不可用"}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              待办操作
            </div>
            <div className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-ink-60">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-40" />
              <p>{todoHint}</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
    </GuestAccessGate>
  );
}
