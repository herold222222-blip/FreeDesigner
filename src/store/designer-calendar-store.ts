"use client";

import { create } from "zustand";
import {
  applyCalendarBatchRules,
  applyEventsToCalendar,
  toggleCalendarPeriod,
} from "@/lib/designer-work-calendar";
import type {
  CalendarSlot,
  DayPeriod,
  WorkCalendarEvent,
  WorkContentItem,
} from "@/lib/types";
import { canEditWorkContents } from "@/lib/work-calendar-content";

export interface CalendarBatchSettings {
  closeWeekend: boolean;
  closeHoliday: boolean;
  allDay: boolean;
}

const DEFAULT_SETTINGS: CalendarBatchSettings = {
  closeWeekend: true,
  closeHoliday: true,
  allDay: false,
};

interface DesignerCalendarState {
  calendars: Record<string, CalendarSlot[]>;
  events: Record<string, WorkCalendarEvent[]>;
  settings: Record<string, CalendarBatchSettings>;
  initialized: Record<string, boolean>;
  ensureDesigner: (designerId: string, seed: CalendarSlot[]) => void;
  hydrateFromDesigner: (
    designer: Pick<
      import("@/lib/types").Designer,
      "id" | "calendar" | "workCalendarEvents" | "calendarBatchSettings"
    >,
  ) => void;
  /** 委托人可选档期（已扣除占用） */
  getCalendar: (designerId: string) => CalendarSlot[];
  /** 接单档期基础数据（不含日程占用，用于工作日历配色） */
  getBaseCalendar: (designerId: string) => CalendarSlot[];
  getEvents: (designerId: string) => WorkCalendarEvent[];
  getSettings: (designerId: string) => CalendarBatchSettings;
  setSettings: (designerId: string, patch: Partial<CalendarBatchSettings>) => void;
  saveBatchSettings: (designerId: string) => void;
  togglePeriod: (designerId: string, date: string, period: DayPeriod) => void;
  addEvent: (
    designerId: string,
    event: Omit<WorkCalendarEvent, "id">,
  ) => WorkCalendarEvent;
  addEvents: (
    designerId: string,
    items: Omit<WorkCalendarEvent, "id">[],
  ) => void;
  removeEvent: (designerId: string, eventId: string) => void;
  updateEventWorkContents: (
    designerId: string,
    eventId: string,
    workContents: WorkContentItem[],
  ) => boolean;
}

export const useDesignerCalendarStore = create<DesignerCalendarState>()(
  (set, get) => ({
      calendars: {},
      events: {},
      settings: {},
      initialized: {},

      ensureDesigner: (designerId, seed) => {
        if (get().initialized[designerId]) return;
        const settings = DEFAULT_SETTINGS;
        const cal = applyCalendarBatchRules([...seed], settings);
        set({
          calendars: { ...get().calendars, [designerId]: cal },
          events: { ...get().events, [designerId]: [] },
          settings: { ...get().settings, [designerId]: settings },
          initialized: { ...get().initialized, [designerId]: true },
        });
      },

      /** 从 API 设计师资料灌入档期（覆盖本地内存） */
      hydrateFromDesigner: (designer) => {
        const settings = designer.calendarBatchSettings ?? DEFAULT_SETTINGS;
        const events = designer.workCalendarEvents ?? [];
        const cal = applyCalendarBatchRules(
          [...(designer.calendar ?? [])],
          settings,
        );
        set({
          calendars: { ...get().calendars, [designer.id]: cal },
          events: { ...get().events, [designer.id]: events },
          settings: { ...get().settings, [designer.id]: settings },
          initialized: { ...get().initialized, [designer.id]: true },
        });
      },

      getBaseCalendar: (designerId) => get().calendars[designerId] ?? [],

      getCalendar: (designerId) => {
        const base = get().getBaseCalendar(designerId);
        const events = get().events[designerId] ?? [];
        return applyEventsToCalendar(base, events);
      },

      getEvents: (designerId) => get().events[designerId] ?? [],

      getSettings: (designerId) =>
        get().settings[designerId] ?? DEFAULT_SETTINGS,

      setSettings: (designerId, patch) => {
        const prev = get().settings[designerId] ?? DEFAULT_SETTINGS;
        set({
          settings: {
            ...get().settings,
            [designerId]: { ...prev, ...patch },
          },
        });
      },

      saveBatchSettings: (designerId) => {
        const cal = get().calendars[designerId] ?? [];
        const settings = get().settings[designerId] ?? DEFAULT_SETTINGS;
        set({
          calendars: {
            ...get().calendars,
            [designerId]: applyCalendarBatchRules(cal, settings),
          },
        });
      },

      togglePeriod: (designerId, date, period) => {
        const cal = get().calendars[designerId] ?? [];
        set({
          calendars: {
            ...get().calendars,
            [designerId]: toggleCalendarPeriod(cal, date, period),
          },
        });
      },

      addEvent: (designerId, event) => {
        const id = `we_${Date.now().toString(36)}`;
        const full: WorkCalendarEvent = { ...event, id };
        set({
          events: {
            ...get().events,
            [designerId]: [...(get().events[designerId] ?? []), full],
          },
        });
        return full;
      },

      addEvents: (designerId, items) => {
        const created = items.map((event, i) => ({
          ...event,
          id: `we_${Date.now().toString(36)}_${i}`,
        }));
        set({
          events: {
            ...get().events,
            [designerId]: [...(get().events[designerId] ?? []), ...created],
          },
        });
      },

      removeEvent: (designerId, eventId) => {
        set({
          events: {
            ...get().events,
            [designerId]: (get().events[designerId] ?? []).filter(
              (e) => e.id !== eventId,
            ),
          },
        });
      },

      updateEventWorkContents: (designerId, eventId, workContents) => {
        const events = get().events[designerId] ?? [];
        const target = events.find((e) => e.id === eventId);
        if (!target) return false;
        if (target.workContentsSavedAt && !canEditWorkContents(target)) {
          return false;
        }
        const now = new Date().toISOString();
        set({
          events: {
            ...get().events,
            [designerId]: events.map((e) =>
              e.id === eventId ?
                {
                  ...e,
                  workContents,
                  workContentsSavedAt: e.workContentsSavedAt ?? now,
                }
              : e,
            ),
          },
        });
        return true;
      },
    }),
);
