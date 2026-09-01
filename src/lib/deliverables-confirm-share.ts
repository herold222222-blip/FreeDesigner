import type { DeliverableFile } from "@/lib/types";
import type { DeliverablePhase } from "@/lib/deliverable-phase";

export interface DeliverablesConfirmShare {
  code: string;
  shareId: string;
  url: string;
}

export interface DeliverablesConfirmPerson {
  id: string;
  name: string;
  avatar?: string | null;
  roleLabel: string;
  trackLabel: string;
}

export interface DeliverablesConfirmFile extends DeliverableFile {
  uploaderName?: string;
}

export interface DeliverablesConfirmView {
  shareId: string;
  confirmed: boolean;
  confirmedAt?: string;
  phase: DeliverablePhase;
  confirmLabel: string;
  canConfirm: boolean;
  preliminaryConfirmedAt?: string;
  preliminarySkipped?: boolean;
  order: {
    id: string;
    code: string;
    title: string;
    projectType: string;
    billingMode: string;
    serviceMode: string;
    expectedDeliveryAt?: string;
    specialty?: string;
    description?: string;
  };
  stage: {
    id: string;
    name: string;
    amount: number;
    ratio: number;
  };
  people: DeliverablesConfirmPerson[];
  files: DeliverablesConfirmFile[];
}

export function buildDeliverablesConfirmUrl(
  shareId: string,
  origin = "",
) {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/confirm-deliverables/${shareId}`;
}
