"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OrderDetailSwitchCard({
  info,
  schedule,
  showSchedule,
  scheduleLabel = "工作日历 & 付款",
  header,
}: {
  info: ReactNode;
  schedule?: ReactNode;
  showSchedule?: boolean;
  scheduleLabel?: string;
  header?: ReactNode;
}) {
  if (!showSchedule || !schedule) {
    return (
      <Card className="p-7">
        {header ? <div className="mb-5">{header}</div> : null}
        {info}
      </Card>
    );
  }

  return (
    <Card className="p-7">
      {header ? <div className="mb-5">{header}</div> : null}
      <Tabs defaultValue="schedule">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="schedule">{scheduleLabel}</TabsTrigger>
          <TabsTrigger value="info">项目信息</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule">{schedule}</TabsContent>
        <TabsContent value="info">{info}</TabsContent>
      </Tabs>
    </Card>
  );
}
