import { maskBountyHallTitle, maskPersonName } from "@/lib/bounty-hall-privacy";

/** 大厅脱敏：首字 + 专业相关后缀，其余 * */
export function maskGuestBountyTitle(title: string): string {
  return maskBountyHallTitle(title);
}

/** 游客：描述中的联系人、电话以 * 替换取值 */
export function maskGuestBountyDescription(description: string): string {
  return description
    .split("\n")
    .map((line) => {
      const contact = line.match(/^(\s*(?:联系人|委托方)[：:])(.*)$/);
      if (contact) {
        return `${contact[1]}${maskPersonName(contact[2] ?? "")}`;
      }
      const phone = line.match(/^(\s*电话[：:])(.*)$/);
      if (phone) {
        const value = phone[2] ?? "";
        const digits = value.replace(/\D/g, "");
        const starCount = Math.max(digits.length || Array.from(value.trim()).length, 11);
        return `${phone[1]}${"*".repeat(starCount)}`;
      }
      return line;
    })
    .join("\n");
}

/** 游客：指定成果提交时间以 * 替换；「协商确定」可直接展示 */
export function maskGuestBountyDeadline(formattedDate: string): string {
  if (formattedDate === "协商确定") return "协商确定";
  return "*".repeat(Math.max(formattedDate.length, 8));
}

/** 游客：指定有效期以 * 替换；「不限」可直接展示 */
export function maskGuestBountyValidUntil(formatted: string): string {
  if (formatted === "不限") return "不限";
  return "*".repeat(Math.max(formatted.length, 8));
}
