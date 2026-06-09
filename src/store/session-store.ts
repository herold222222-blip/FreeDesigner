"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HalfDaySlot, ScheduleRequest, ServiceMode } from "@/lib/types";

export interface DemoNotification {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
  createdAt: number;
}

export interface DraftOrderPayload {
  title: string;
  serviceMode: ServiceMode;
  billingMode: "daily" | "monthly";
  days: number;
  months: number;
  totalAmount: number;
  subSpecialty: string;
  projectType: string;
  description: string;
  selectedSlots: HalfDaySlot[];
  selectedMonths?: string[];
  address?: string;
  scheduleFrom?: string;
  scheduleTo?: string;
  status: "pending_schedule" | "pending_contract" | "rejected";
  scheduleRequestId?: string;
}

interface SessionState {
  draftOrders: Array<{
    id: string;
    designerId: string;
    createdAt: string;
    payload: DraftOrderPayload;
  }>;
  draftBounties: Array<{ id: string; createdAt: string; payload: Record<string, unknown> }>;
  scheduleRequests: ScheduleRequest[];
  notifications: DemoNotification[];
  pushNotification: (n: Omit<DemoNotification, "id" | "createdAt">) => void;
  dismissNotification: (id: string) => void;
  appendDraftOrder: (designerId: string, payload: Omit<DraftOrderPayload, "status">) => string;
  appendDraftBounty: (payload: Record<string, unknown>) => string;
  submitScheduleRequest: (req: Omit<ScheduleRequest, "id" | "status" | "submittedAt">) => string;
  acceptScheduleRequest: (requestId: string) => void;
  rejectScheduleRequest: (requestId: string, reason?: string) => void;
  getPendingScheduleForDesigner: (designerId: string) => ScheduleRequest[];
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      draftOrders: [],
      draftBounties: [],
      scheduleRequests: [],
      notifications: [],
      pushNotification: (n) => {
        const note: DemoNotification = {
          id: Math.random().toString(36).slice(2, 10),
          createdAt: Date.now(),
          ...n,
        };
        set({ notifications: [...get().notifications, note] });
        setTimeout(() => {
          set({
            notifications: get().notifications.filter((x) => x.id !== note.id),
          });
        }, 4500);
      },
      dismissNotification: (id) =>
        set({ notifications: get().notifications.filter((n) => n.id !== id) }),
      appendDraftOrder: (designerId, payload) => {
        const id = `ORD-${Date.now().toString(36).toUpperCase()}`;
        set({
          draftOrders: [
            ...get().draftOrders,
            {
              id,
              designerId,
              createdAt: new Date().toISOString(),
              payload: { ...payload, status: "pending_schedule" },
            },
          ],
        });
        return id;
      },
      appendDraftBounty: (payload) => {
        const id = `BTY-${Date.now().toString(36).toUpperCase()}`;
        set({
          draftBounties: [
            ...get().draftBounties,
            { id, createdAt: new Date().toISOString(), payload },
          ],
        });
        return id;
      },
      submitScheduleRequest: (req) => {
        const id = `SCH-${Date.now().toString(36).toUpperCase()}`;
        const request: ScheduleRequest = {
          ...req,
          id,
          status: "pending",
          submittedAt: new Date().toISOString(),
        };
        set({ scheduleRequests: [...get().scheduleRequests, request] });
        set({
          draftOrders: get().draftOrders.map((o) =>
            o.id === req.orderId
              ? {
                  ...o,
                  payload: {
                    ...o.payload,
                    scheduleRequestId: id,
                    status: "pending_schedule" as const,
                  },
                }
              : o,
          ),
        });
        return id;
      },
      acceptScheduleRequest: (requestId) => {
        const now = new Date().toISOString();
        set({
          scheduleRequests: get().scheduleRequests.map((r) =>
            r.id === requestId
              ? { ...r, status: "accepted" as const, respondedAt: now }
              : r,
          ),
        });
        const req = get().scheduleRequests.find((r) => r.id === requestId);
        if (req) {
          set({
            draftOrders: get().draftOrders.map((o) =>
              o.id === req.orderId
                ? {
                    ...o,
                    payload: {
                      ...o.payload,
                      status: "pending_contract" as const,
                    },
                  }
                : o,
            ),
          });
        }
      },
      rejectScheduleRequest: (requestId, reason) => {
        const now = new Date().toISOString();
        set({
          scheduleRequests: get().scheduleRequests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "rejected" as const,
                  respondedAt: now,
                  rejectReason: reason,
                }
              : r,
          ),
        });
        const req = get().scheduleRequests.find((r) => r.id === requestId);
        if (req) {
          set({
            draftOrders: get().draftOrders.map((o) =>
              o.id === req.orderId
                ? {
                    ...o,
                    payload: { ...o.payload, status: "rejected" as const },
                  }
                : o,
            ),
          });
        }
      },
      getPendingScheduleForDesigner: (designerId) =>
        get().scheduleRequests.filter(
          (r) => r.designerId === designerId && r.status === "pending",
        ),
    }),
    { name: "lezyou-session" },
  ),
);
