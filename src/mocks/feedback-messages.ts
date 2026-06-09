import type { FeedbackMessage } from "@/lib/types";

export const demoFeedbackMessages: FeedbackMessage[] = [
  {
    id: "fb_demo_1",
    audience: "designer",
    identityId: "designer_chen",
    userName: "陈墨白",
    phone: "139****8821",
    message: "请问见习设计师完成首单后，晋升审批一般需要多久？",
    status: "pending",
    createdAt: "2026-06-04T14:20:00+08:00",
  },
  {
    id: "fb_demo_2",
    audience: "client",
    identityId: "client_lin",
    userName: "林晚晴",
    phone: "138****6688",
    message: "企业认证审核中，想确认是否可以先发布悬赏委托？",
    status: "pending",
    createdAt: "2026-06-03T09:15:00+08:00",
  },
  {
    id: "fb_demo_3",
    audience: "designer",
    identityId: "designer_wang",
    userName: "王境泽设计团队",
    phone: "139****4000",
    message: "团队入驻后，成员接单额度如何计算？",
    status: "replied",
    createdAt: "2026-05-28T16:40:00+08:00",
    repliedAt: "2026-05-29T10:00:00+08:00",
    replyNote: "已电话说明团队负责人统一接单规则。",
  },
];
