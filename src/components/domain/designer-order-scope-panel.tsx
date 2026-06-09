"use client";

import type { Designer, Order } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DeliverableFileList } from "@/components/domain/deliverable-file-list";
import { getServiceProviderById } from "@/mocks/service-providers";
import {
  getAssignmentDeliverables,
  getAuditsForDesignerTracks,
  getDesignerOwnHistoricalDeliverables,
  getDesignerTrackAssignments,
  getPeerTrackAssignments,
  designerHasProjectManagement,
  trackLabel,
} from "@/lib/designer-order-scope";
import { resolveTrackLabels } from "@/lib/constants";
import {
  ChevronRight,
  FileBox,
  FileSearch,
  History,
  UserCog,
  Users,
} from "lucide-react";

export function DesignerOrderScopePanel({
  order,
  designerId,
  getDesigner,
}: {
  order: Order;
  designerId: string;
  getDesigner: (id: string) => Designer | undefined;
}) {
  const myTracks = getDesignerTrackAssignments(order, designerId);
  const peerTracks = getPeerTrackAssignments(order, designerId);
  const audits = getAuditsForDesignerTracks(order, designerId);
  const showPm = designerHasProjectManagement(order, designerId);

  if (
    myTracks.length === 0 &&
    peerTracks.length === 0 &&
    !order.withAuditService &&
    !showPm
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      {myTracks.length > 0 ? (
        <Card className="p-7">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            我的专业分工
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            仅展示与你相关的专业记录、协助设计师、审图与本人历史成果。
          </p>
          <div className="mt-4 space-y-4">
            {myTracks.map((assignment) => {
              const labels = resolveTrackLabels(
                assignment.l1,
                assignment.l2,
                assignment.l3,
              );
              const stage = order.stages.find((s) => s.id === assignment.stageId);
              const deliverables = getAssignmentDeliverables(order, assignment);
              const historical = getDesignerOwnHistoricalDeliverables(
                order,
                designerId,
                assignment.id,
              );
              const stageAudits = audits.filter(
                (a) => a.trackAssignmentId === assignment.id,
              );

              return (
                <div
                  key={assignment.id}
                  className="rounded-2xl border border-ink-20 bg-ink-20/10 p-4"
                >
                  <div className="flex flex-wrap items-center gap-1 text-xs text-ink-60">
                    <span className="font-medium text-ink">{labels.l1Label}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{labels.l2Label}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{labels.l3Label}</span>
                  </div>
                  {stage ? (
                    <div className="mt-2 text-xs text-ink-60">
                      当前阶段：<span className="font-medium text-ink">{stage.name}</span>
                    </div>
                  ) : null}

                  {deliverables.length > 0 ? (
                    <div className="mt-4 border-t border-dashed border-ink-20 pt-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-40">
                        <FileBox className="h-3.5 w-3.5" />
                        我的本阶段成果
                      </div>
                      <DeliverableFileList
                        files={deliverables}
                        getDesigner={getDesigner}
                      />
                    </div>
                  ) : null}

                  {historical.length > 0 ? (
                    <div className="mt-4 border-t border-dashed border-ink-20 pt-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-40">
                        <History className="h-3.5 w-3.5" />
                        我的历史提交成果
                      </div>
                      <DeliverableFileList
                        files={historical}
                        getDesigner={getDesigner}
                        compact
                      />
                    </div>
                  ) : null}

                  {stageAudits.length > 0 ? (
                    <div className="mt-4 border-t border-dashed border-amber-200/80 pt-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-800">
                        <FileSearch className="h-3.5 w-3.5" />
                        本专业审图师
                      </div>
                      <div className="space-y-2">
                        {stageAudits.map((audit) => {
                          const auditor = getServiceProviderById(audit.auditorId);
                          const auditFiles =
                            order.stages
                              .find((s) => s.id === audit.stageId)
                              ?.deliverables?.filter((d) =>
                                audit.deliverableIds?.includes(d.id),
                              ) ?? [];
                          return (
                            <div
                              key={audit.id}
                              className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3"
                            >
                              {auditor ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={auditor.avatar} alt={auditor.name} />
                                    <AvatarFallback>
                                      {auditor.name.slice(0, 1)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="text-sm font-medium text-ink">
                                      {auditor.name}
                                    </div>
                                    <div className="text-xs text-ink-60">
                                      {auditor.title}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              {auditFiles.length > 0 ? (
                                <div className="mt-2">
                                  <DeliverableFileList
                                    files={auditFiles}
                                    compact
                                    unlocked
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {showPm && order.projectManagement ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-900">
            <UserCog className="h-4 w-4" />
            项目管理员（整体协调）
          </div>
          {(() => {
            const manager = getServiceProviderById(
              order.projectManagement!.projectManagerId,
            );
            const pmFiles =
              order.stages
                .find((s) => s.id === order.projectManagement!.stageId)
                ?.deliverables?.filter((d) =>
                  order.projectManagement!.deliverableIds?.includes(d.id),
                ) ?? [];
            return (
              <div className="rounded-xl border border-violet-200/60 bg-violet-50/30 p-4">
                {manager ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={manager.avatar} alt={manager.name} />
                      <AvatarFallback>{manager.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {manager.name}
                      </div>
                      <div className="text-xs text-ink-60">{manager.title}</div>
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-ink-60">
                  {order.projectManagement!.scope}
                </p>
                {pmFiles.length > 0 ? (
                  <div className="mt-3">
                    <DeliverableFileList files={pmFiles} compact unlocked />
                  </div>
                ) : null}
              </div>
            );
          })()}
        </Card>
      ) : null}

      {peerTracks.length > 0 ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-60" />
            <h3 className="text-sm font-semibold text-ink">同项目其他专业设计师</h3>
          </div>
          <p className="mb-3 text-xs text-ink-60">
            可查看当前对接人，不展示其他专业的金额与成果。
          </p>
          <div className="flex flex-wrap gap-2">
            {peerTracks.map((a) => {
              const d = getDesigner(a.designerId);
              return (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-20 bg-white px-3 py-1.5"
                >
                  {d ? (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={d.avatar} alt={d.name} />
                      <AvatarFallback>{d.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                  ) : null}
                  <span className="text-xs text-ink">{d?.name ?? "—"}</span>
                  <Badge variant="muted" className="text-[10px]">
                    {trackLabel(a)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
