"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkCalendarEvent } from "@/lib/types";
import {
  canEditWorkContents,
  formatEditRemaining,
  normalizeWorkContentInputs,
  workContentEditRemainingMs,
  workContentsToInputs,
} from "@/lib/work-calendar-content";
import { Minus, Plus } from "lucide-react";

export function WorkCalendarContentEditor({
  event,
  onSave,
}: {
  event: WorkCalendarEvent;
  onSave: (lines: string[]) => void;
}) {
  const [lines, setLines] = useState<string[]>(() =>
    workContentsToInputs(event.workContents),
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    workContentEditRemainingMs(event),
  );

  useEffect(() => {
    setLines(workContentsToInputs(event.workContents));
  }, [event.id, event.workContents]);

  useEffect(() => {
    const tick = () => setRemainingMs(workContentEditRemainingMs(event));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [event]);

  const editable = canEditWorkContents(event);

  const updateLine = (index: number, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === index ? value : l)));
  };

  const addLine = () => setLines((prev) => [...prev, ""]);

  const removeLine = (index: number) => {
    setLines((prev) =>
      prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index),
    );
  };

  const handleSave = () => {
    onSave(normalizeWorkContentInputs(lines).map((i) => i.text));
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink-20 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-medium text-ink">工作内容</Label>
          <p className="mt-0.5 text-[11px] text-ink-60">
            可填写多条，委托人与管理员可见
          </p>
        </div>
        <span className="text-[11px] text-ink-40">
          {editable ? formatEditRemaining(remainingMs) : "已超过 24 小时，不可修改"}
        </span>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={line}
              disabled={!editable}
              placeholder={`工作内容 ${index + 1}`}
              onChange={(e) => updateLine(index, e.target.value)}
            />
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeLine(index)}
                disabled={lines.length <= 1 && !line}
              >
                <Minus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> 增加一条
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleSave}
            disabled={!lines.some((l) => l.trim())}
          >
            保存工作内容
          </Button>
        </div>
      ) : (
        <ul className="space-y-1.5 text-sm text-ink">
          {(event.workContents ?? []).map((item) => (
            <li
              key={item.id}
              className="rounded-lg bg-ink-20/20 px-3 py-2 text-sm"
            >
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
