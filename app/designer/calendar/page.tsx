"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDesigner, useScheduleRequests } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { persistDesignerCalendar } from "@/lib/designer-calendar-persist";
import { DesignerSchedulePicker } from "@/components/domain/designer-schedule-picker";
import { ScheduleRequestPanel } from "@/components/domain/schedule-request-panel";
import { CalendarDays, CalendarRange, Save } from "lucide-react";

export default function CalendarPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer, loading } = useDesigner(identityId);
  const { data: scheduleRequests, refresh: refreshSchedule } =
    useScheduleRequests();
  const push = useSessionStore((s) => s.pushNotification);

  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getCalendar = useDesignerCalendarStore((s) => s.getCalendar);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);
  const getSettings = useDesignerCalendarStore((s) => s.getSettings);
  const setSettings = useDesignerCalendarStore((s) => s.setSettings);
  const saveBatchSettings = useDesignerCalendarStore((s) => s.saveBatchSettings);
  const togglePeriod = useDesignerCalendarStore((s) => s.togglePeriod);

  useEffect(() => {
    if (designer) hydrateFromDesigner(designer);
  }, [designer, hydrateFromDesigner]);

  const pendingForDesigner = scheduleRequests.filter(
    (r) => r.designerId === designer?.id && r.status === "pending",
  );

  if (loading || !designer) {
    return <div className="py-20 text-center text-ink-60">正在加载档期...</div>;
  }

  const calendar = getCalendar(designer.id);
  const settings = getSettings(designer.id);

  const handleAllDayChange = (open: boolean) => {
    setSettings(designer.id, {
      allDay: open,
      ...(open ? { closeWeekend: false, closeHoliday: false } : {}),
    });
  };

  const handleCloseWeekendChange = (closed: boolean) => {
    setSettings(designer.id, {
      closeWeekend: closed,
      ...(closed ? { allDay: false } : {}),
    });
  };

  const handleCloseHolidayChange = (closed: boolean) => {
    setSettings(designer.id, {
      closeHoliday: closed,
      ...(closed ? { allDay: false } : {}),
    });
  };

  const handleSave = async () => {
    saveBatchSettings(designer.id);
    try {
      await persistDesignerCalendar(designer.id);
      push({
        title: "档期设置已保存",
        description: "批量规则已同步至服务器。",
        variant: "success",
      });
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            接单档期
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            设置可接单时间（上午/下午半天粒度）。委托人定向下单或预约上门时，只能在空闲档期内选择。
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/designer/calendar/work">
            <CalendarDays className="h-4 w-4" />
            工作日历
          </Link>
        </Button>
      </div>

      {pendingForDesigner.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">待确认档期申请</h3>
          <ScheduleRequestPanel
            requests={pendingForDesigner}
            perspective="designer"
            onUpdated={refreshSchedule}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-ink-60" />
            <h3 className="text-base font-semibold text-ink">档期日历</h3>
          </div>
          <p className="mb-4 text-xs text-ink-60">
            点击上午/下午单元格可切换开放状态；已占用时段（项目或日程）不可开放。
          </p>
          <DesignerSchedulePicker
            calendar={calendar}
            value={[]}
            readOnly={false}
            initialYear={2026}
            initialMonth={5}
            onToggleAvailability={async (date, period) => {
              const occupied = getEvents(designer.id).some(
                (e) => e.date === date && e.period === period,
              );
              if (occupied) {
                push({
                  title: "该时段已有工作安排",
                  description: "请在工作日历中调整日程后再修改档期。",
                  variant: "destructive",
                });
                return;
              }
              togglePeriod(designer.id, date, period);
              try {
                await persistDesignerCalendar(designer.id);
              } catch {
                push({ title: "档期同步失败", variant: "destructive" });
              }
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-semibold text-ink">批量设置</h3>
            <ToggleRow
              label="关闭周末"
              checked={settings.closeWeekend}
              disabled={settings.allDay}
              onChange={handleCloseWeekendChange}
            />
            <ToggleRow
              label="关闭法定节假日"
              checked={settings.closeHoliday}
              disabled={settings.allDay}
              onChange={handleCloseHolidayChange}
            />
            <ToggleRow
              label="全年全时段开放接单"
              checked={settings.allDay}
              onChange={handleAllDayChange}
            />
            {settings.allDay ? (
              <p className="text-xs text-ink-40">
                已开启全年全时段接单，周末与法定节假日档期将自动开放。
              </p>
            ) : null}
            <Button variant="brand" className="w-full" onClick={handleSave}>
              <Save className="h-4 w-4" /> 保存设置
            </Button>
          </Card>

          <Card className="p-5 text-xs text-ink-60">
            <div className="font-medium text-ink">沟通时段</div>
            <div className="mt-1">{designer.meetingFlexibility}</div>
            <Label className="mt-4 block">修改沟通时段</Label>
            <Button variant="outline" size="sm" className="mt-2 w-full">
              编辑
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm${disabled ? " opacity-50" : ""}`}
    >
      <span className="text-ink">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
