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

const DEMO_EVENTS: Record<string, WorkCalendarEvent[]> = {
  designer_chen: [
    {
      id: "we_chen_lh_1",
      date: "2026-05-06",
      period: "am",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
      workContents: [
        { id: "wc_lh_1", text: "施工图节点核对与软装收口清单" },
        { id: "wc_lh_2", text: "现场与施工方对接机电预留" },
      ],
      workContentsSavedAt: "2026-05-06T12:30:00+08:00",
    },
    {
      id: "we_chen_lh_2",
      date: "2026-05-06",
      period: "pm",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
    },
    {
      id: "we_chen_lh_3",
      date: "2026-05-08",
      period: "am",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
      workContents: [{ id: "wc_lh_3", text: "补填：木作深化图纸审核" }],
      workContentsSavedAt: "2026-06-05T09:00:00+08:00",
    },
    {
      id: "we_chen_lh_4",
      date: "2026-05-12",
      period: "pm",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
    },
    {
      id: "we_chen_lh_5",
      date: "2026-05-15",
      period: "am",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
      workContents: [{ id: "wc_lh_5", text: "驻场材料样板确认" }],
      workContentsSavedAt: "2026-05-15T11:00:00+08:00",
    },
    {
      id: "we_chen_lh_6",
      date: "2026-06-03",
      period: "am",
      title: "成都麓湖 · 高层住宅室内按月驻场",
      source: "order",
      orderCode: "ID2026031008",
    },
    {
      id: "we_chen_1",
      date: "2026-05-07",
      period: "am",
      title: "良渚文化村 · 施工图深化",
      source: "order",
      orderCode: "LA2026042210",
      workContents: [
        { id: "wc_demo_1", text: "园建铺装与小品节点深化" },
        { id: "wc_demo_2", text: "与委托人确认中期成果清单" },
      ],
      workContentsSavedAt: "2026-06-05T08:00:00+08:00",
    },
    {
      id: "we_chen_2",
      date: "2026-05-06",
      period: "pm",
      title: "良渚文化村 · 施工图深化",
      source: "order",
      orderCode: "LA2026042210",
    },
    {
      id: "we_chen_3",
      date: "2026-05-08",
      period: "am",
      title: "苏州博物馆片区 · 概念方案",
      source: "order",
      orderCode: "AD2026040509",
    },
    {
      id: "we_chen_4",
      date: "2026-05-12",
      period: "pm",
      title: "团队内部方案评审",
      source: "manual",
      note: "线下会议室",
    },
  ],
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
        const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "off";
        const settings = DEFAULT_SETTINGS;
        const events =
          demoMode ? (DEMO_EVENTS[designerId] ?? []) : [];
        const cal = applyCalendarBatchRules([...seed], settings);
        set({
          calendars: { ...get().calendars, [designerId]: cal },
          events: { ...get().events, [designerId]: events },
          settings: { ...get().settings, [designerId]: settings },
          initialized: { ...get().initialized, [designerId]: true },
        });
      },

      /** 从 API 设计师资料灌入档期（覆盖本地内存） */
      hydrateFromDesigner: (designer) => {
        const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "off";
        const settings = designer.calendarBatchSettings ?? DEFAULT_SETTINGS;
        const events =
          designer.workCalendarEvents?.length ?
            designer.workCalendarEvents
          : demoMode ?
            (DEMO_EVENTS[designer.id] ?? [])
          : [];
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
