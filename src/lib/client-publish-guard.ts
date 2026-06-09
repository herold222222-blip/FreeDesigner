import type { Client } from "@/lib/types";

/** 个人委托人可直接发布；企业委托人须审核通过 */
export function canClientPublishEntrust(client: Client): boolean {
  if (client.type === "individual") return true;
  return client.verified === true;
}

export function clientPublishBlockedMessage(client: Client): string {
  if (client.type !== "enterprise" || client.verified) return "";
  return "企业认证资料审核通过前，暂不可发布常规委托与悬赏委托。请等待平台审核或联系客服。";
}
