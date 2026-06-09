"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function DesignerSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          账号设置
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          管理基础信息、银行卡、消息提醒。
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-ink">基础信息</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Label>姓名</Label>
            <Input className="mt-2" defaultValue="陈牧之" />
          </div>
          <div>
            <Label>手机号</Label>
            <Input className="mt-2" defaultValue="139 ****8821" disabled />
          </div>
          <div>
            <Label>所在城市</Label>
            <Input className="mt-2" defaultValue="上海市 · 徐汇区" />
          </div>
          <div>
            <Label>资质状态</Label>
            <div className="mt-2 inline-flex h-11 items-center gap-2 rounded-xl border border-ink-20 px-3 text-sm">
              <Badge variant="emerald">已通过审核</Badge>
              <span className="text-ink-60">2025-09-01 通过</span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="brand">保存修改</Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">提现银行卡</h3>
            <p className="mt-1 text-sm text-ink-60">
              中国建设银行 · 尾号 8821 · 持卡人 陈牧之
            </p>
          </div>
          <Button variant="outline">更换</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-ink">消息提醒</h3>
        <div className="mt-5 space-y-3 text-sm text-ink-60">
          {[
            "新订单 / 合同签署提醒(默认开启)",
            "返修请求提醒",
            "悬赏推荐(基于专业)",
            "钱包到账与解冻提醒",
          ].map((item, i) => (
            <label
              key={i}
              className="flex items-center justify-between rounded-xl border border-ink-20 p-4"
            >
              <span>{item}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
