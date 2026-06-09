"use client";

import { useState } from "react";
import { Plus, KeyRound, Snowflake, Trash2, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminPhoneLink } from "@/components/domain/admin-phone-link";
import {
  createPlatformAdminRequest,
  deletePlatformAdminRequest,
  updatePlatformAdminRequest,
} from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import type { PlatformAdminAccount } from "@/lib/types";

export function PlatformAdminsPanel({
  admins,
  loading,
  refresh,
}: {
  admins: PlatformAdminAccount[];
  loading: boolean;
  refresh: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<PlatformAdminAccount | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PlatformAdminAccount | null>(
    null,
  );

  const [addForm, setAddForm] = useState({
    loginName: "",
    name: "",
    password: "",
    phone: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetAddForm = () =>
    setAddForm({ loginName: "", name: "", password: "", phone: "" });

  const handleCreate = async () => {
    if (!addForm.loginName.trim() || !addForm.name.trim() || !addForm.password) {
      push({ title: "请填写登录账号、姓名与密码", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await createPlatformAdminRequest({
        loginName: addForm.loginName.trim(),
        name: addForm.name.trim(),
        password: addForm.password,
        phone: addForm.phone.trim() || undefined,
      });
      push({ title: "管理员账号已创建", variant: "success" });
      setAddOpen(false);
      resetAddForm();
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "创建失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassword = async () => {
    if (!passwordTarget) return;
    if (!newPassword || newPassword.length < 6) {
      push({ title: "新密码至少 6 位", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      push({ title: "两次输入的密码不一致", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await updatePlatformAdminRequest(passwordTarget.id, {
        password: newPassword,
      });
      push({
        title: `已更新「${passwordTarget.loginName}」的密码`,
        variant: "success",
      });
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "修改失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: PlatformAdminAccount) => {
    const next = admin.status === "active" ? "disabled" : "active";
    setBusyId(admin.id);
    try {
      await updatePlatformAdminRequest(admin.id, { status: next });
      push({
        title:
          next === "disabled"
            ? `已冻结「${admin.loginName}」`
            : `已解冻「${admin.loginName}」`,
        variant: "success",
      });
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deletePlatformAdminRequest(deleteTarget.id);
      push({
        title: `已删除管理员「${deleteTarget.loginName}」`,
        variant: "success",
      });
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "删除失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-60">
          管理平台管理员登录账号，支持修改密码、冻结 / 解冻与删除。超级管理员账号不在此列表中。
        </p>
        <Button variant="brand" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          添加管理员
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-ink-60">加载中...</div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-60">
            暂无平台管理员，点击右上角添加。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-ink-20 bg-ink-20/20 text-xs uppercase tracking-wider text-ink-40">
                <tr>
                  <th className="px-5 py-3 text-left">登录账号</th>
                  <th className="px-5 py-3 text-left">姓名</th>
                  <th className="px-5 py-3 text-left">手机号</th>
                  <th className="px-5 py-3 text-left">状态</th>
                  <th className="px-5 py-3 text-left">创建时间</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr
                    key={admin.id}
                    className="border-b border-ink-20 last:border-b-0"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {admin.loginName}
                    </td>
                    <td className="px-5 py-3 text-ink">{admin.name}</td>
                    <td className="px-5 py-3">
                      <AdminPhoneLink phone={admin.phone} />
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          admin.status === "active" ? "emerald" : "amber"
                        }
                      >
                        {admin.status === "active" ? "正常" : "已冻结"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-60">{admin.createdAt}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === admin.id}
                          onClick={() => {
                            setPasswordTarget(admin);
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          改密
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === admin.id}
                          onClick={() => handleToggleStatus(admin)}
                        >
                          {admin.status === "active" ? (
                            <>
                              <Snowflake className="h-3.5 w-3.5" />
                              冻结
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              解冻
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={busyId === admin.id}
                          onClick={() => setDeleteTarget(admin)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加平台管理员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>登录账号</Label>
              <Input
                placeholder="如 FDmanage"
                value={addForm.loginName}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, loginName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                placeholder="显示名称"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>初始密码</Label>
              <Input
                type="password"
                placeholder="至少 6 位"
                value={addForm.password}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>手机号（选填）</Label>
              <Input
                placeholder="不填则系统自动生成"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              variant="brand"
              disabled={submitting}
              onClick={handleCreate}
            >
              {submitting ? "创建中..." : "确认添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              修改密码 · {passwordTarget?.loginName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)}>
              取消
            </Button>
            <Button
              variant="brand"
              disabled={submitting}
              onClick={handlePassword}
            >
              {submitting ? "保存中..." : "保存密码"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除管理员</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-60">
            确定删除管理员「
            <strong className="text-ink">{deleteTarget?.loginName}</strong>
            」？该操作不可恢复，其登录会话将立即失效。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={handleDelete}
            >
              {submitting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
