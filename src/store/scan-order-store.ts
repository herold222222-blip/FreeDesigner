"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  computeScanOrderTotal,
  type ScanOrder,
  type ScanOrderStatus,
  type ScanPaymentStageDraft,
  type ScanPricingMode,
} from "@/lib/scan-order";
import type { BillingMode, ServiceMode } from "@/lib/types";

export interface CreateScanOrderInput {
  designerId: string;
  clientId: string;
  pricingMode: ScanPricingMode;
  serviceMode: ServiceMode;
  billingMode?: BillingMode;
  workDays?: number;
  months?: number;
  unitDaily?: number;
  unitMonthly?: number;
  fixedAmount?: number;
  title: string;
  description: string;
  paymentStages: ScanPaymentStageDraft[];
}

interface ScanOrderState {
  orders: ScanOrder[];
  createOrder: (input: CreateScanOrderInput) => string;
  getOrder: (id: string) => ScanOrder | undefined;
  getOrdersForDesigner: (designerId: string) => ScanOrder[];
  getOrdersForClient: (clientId: string) => ScanOrder[];
  designerConfirm: (
    id: string,
    stages: ScanPaymentStageDraft[],
    note?: string,
  ) => void;
  designerReject: (id: string, reason?: string) => void;
  signAsClient: (id: string) => void;
  signAsDesigner: (id: string) => void;
  markPrepayPaid: (id: string) => void;
}

function contractIdFor(orderId: string) {
  return `CTR-SCAN-${orderId}`;
}

export const useScanOrderStore = create<ScanOrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      createOrder: (input) => {
        const id = `SCAN-${Date.now().toString(36).toUpperCase()}`;
        const totalAmount = computeScanOrderTotal(input);
        const order: ScanOrder = {
          id,
          designerId: input.designerId,
          clientId: input.clientId,
          createdAt: new Date().toISOString(),
          status: "pending_designer_confirm",
          pricingMode: input.pricingMode,
          serviceMode: input.serviceMode,
          billingMode: input.billingMode,
          workDays: input.workDays,
          months: input.months,
          unitDaily: input.unitDaily,
          unitMonthly: input.unitMonthly,
          fixedAmount: input.fixedAmount,
          title: input.title,
          description: input.description,
          paymentStages: input.paymentStages,
          contractId: contractIdFor(id),
          totalAmount,
          signedByClient: false,
          signedByDesigner: false,
          prepayPaid: false,
        };
        set({ orders: [...get().orders, order] });
        return id;
      },
      getOrder: (id) => get().orders.find((o) => o.id === id),
      getOrdersForDesigner: (designerId) =>
        get().orders.filter((o) => o.designerId === designerId),
      getOrdersForClient: (clientId) =>
        get().orders.filter((o) => o.clientId === clientId),
      designerConfirm: (id, stages, note) => {
        const o = get().orders.find((x) => x.id === id);
        if (!o) return;
        const totalAmount = computeScanOrderTotal(o);
        const next: ScanOrderStatus = "pending_contract";
        set({
          orders: get().orders.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: next,
                  paymentStages: stages,
                  designerNote: note,
                  totalAmount,
                }
              : x,
          ),
        });
      },
      designerReject: (id, reason) => {
        set({
          orders: get().orders.map((x) =>
            x.id === id ? { ...x, status: "rejected" as const, rejectReason: reason } : x,
          ),
        });
      },
      signAsClient: (id) => {
        set({
          orders: get().orders.map((x) => {
            if (x.id !== id) return x;
            const next = { ...x, signedByClient: true };
            if (next.signedByDesigner) next.status = "pending_prepay";
            return next;
          }),
        });
      },
      signAsDesigner: (id) => {
        set({
          orders: get().orders.map((x) => {
            if (x.id !== id) return x;
            const next = { ...x, signedByDesigner: true };
            if (next.signedByClient) next.status = "pending_prepay";
            return next;
          }),
        });
      },
      markPrepayPaid: (id) => {
        set({
          orders: get().orders.map((x) =>
            x.id === id
              ? { ...x, prepayPaid: true, status: "in_service" as const }
              : x,
          ),
        });
      },
    }),
    { name: "lezyou-scan-orders" },
  ),
);
