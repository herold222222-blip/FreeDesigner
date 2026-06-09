import type { ReviewItem } from "@/lib/types";

export const reviewQueue: ReviewItem[] = [
  {
    id: "rv_d_1",
    type: "designer",
    name: "苏河",
    submittedAt: "2026-04-30T10:30:00+08:00",
    status: "pending",
    payload: {
      手机号: "139****8821",
      所在地: "南京市 · 鼓楼区",
      专业: "建筑设计 · 方案概念 / 建筑施工图",
      工作年限: "8 年",
      作品集: "12 个项目案例",
      服务模式: "线上 + 线下",
    },
  },
  {
    id: "rv_d_2",
    type: "designer",
    name: "邓明川",
    submittedAt: "2026-04-29T16:00:00+08:00",
    status: "pending",
    payload: {
      手机号: "186****6612",
      所在地: "重庆 · 渝中区",
      专业: "景观设计 · 园建/绿化/给排水",
      工作年限: "6 年",
      作品集: "8 个项目案例",
      服务模式: "线上",
    },
  },
  {
    id: "rv_d_3",
    type: "designer",
    name: "温清禾",
    submittedAt: "2026-04-28T11:00:00+08:00",
    status: "approved",
    payload: {
      手机号: "159****0033",
      所在地: "西安 · 雁塔区",
      专业: "室内设计 · 软装陈设",
      工作年限: "4 年",
      作品集: "6 个项目案例",
      服务模式: "线上 + 线下",
    },
  },
  {
    id: "rv_e_1",
    type: "enterprise",
    name: "青源置业(杭州)有限公司",
    submittedAt: "2026-04-21T09:00:00+08:00",
    status: "pending",
    payload: {
      联系人: "陈先生",
      手机号: "135****7788",
      统一社会信用代码: "913301006***5524",
      经营范围: "房地产开发、建筑装饰",
      营业执照: "已上传(JPG · 2.4MB)",
      注册资本: "5000 万元",
    },
  },
  {
    id: "rv_e_2",
    type: "enterprise",
    name: "禹生文旅产业(深圳)有限公司",
    submittedAt: "2026-04-15T14:30:00+08:00",
    status: "approved",
    payload: {
      联系人: "李总",
      手机号: "189****1230",
      统一社会信用代码: "914403006***1198",
      经营范围: "文旅项目投资、文化创意",
      营业执照: "已上传(PDF · 3.1MB)",
      注册资本: "1 亿元",
    },
  },
  {
    id: "rv_e_3",
    type: "enterprise",
    name: "原野设计工坊",
    submittedAt: "2026-04-10T10:00:00+08:00",
    status: "rejected",
    payload: {
      联系人: "王女士",
      手机号: "187****0099",
      统一社会信用代码: "缺失",
      经营范围: "设计咨询",
      营业执照: "证照模糊,无法核验",
      注册资本: "10 万元",
      驳回理由: "营业执照影像不清晰,请重新上传",
    },
  },
  {
    id: "rv_promo_1",
    type: "designer_promotion",
    name: "唐羽 · 见习晋级",
    submittedAt: "2026-05-01T08:00:00+08:00",
    status: "pending",
    refId: "designer_tang",
    payload: {
      当前等级: "见习设计师",
      申请晋升: "中级设计师v1",
      完成订单: "厦门鼓浪屿民宿 · 概念方案",
      订单编号: "AD2026041503",
      设计师编号: "DS000007",
      完成时间: "2026-04-28",
    },
  },
  {
    id: "rv_promo_2",
    type: "designer_level_promotion",
    name: "陈墨白 · 等级晋级",
    submittedAt: "2026-05-28T10:00:00+08:00",
    status: "pending",
    refId: "designer_chen",
    payload: {
      当前等级: "中级设计师v1",
      申请晋升: "高级设计师v1",
      完成订单数: "6",
      单均评价: "4.72",
      最低单评: "4.5",
      设计师编号: "DS000001",
    },
  },
];

/** 演示用待处理工单（API 无数据时合并展示） */
export function getDemoPendingReviewCounts() {
  const pending = reviewQueue.filter((r) => r.status === "pending");
  return {
    designer: pending.filter((r) => r.type === "designer").length,
    enterprise: pending.filter((r) => r.type === "enterprise").length,
    promotion: pending.filter((r) => r.type === "designer_promotion").length,
    levelPromotion: pending.filter(
      (r) => r.type === "designer_level_promotion",
    ).length,
  };
}
