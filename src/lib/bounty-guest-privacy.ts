/** 游客：项目名称仅保留前 3 个字，其余以 * 隐藏 */
export function maskGuestBountyTitle(title: string): string {
  const chars = Array.from(title.trim());
  if (chars.length <= 3) return chars.join("");
  return chars.slice(0, 3).join("") + "*".repeat(chars.length - 3);
}

/** 游客：描述中的联系人、电话以 * 替换取值 */
export function maskGuestBountyDescription(description: string): string {
  return description
    .split("\n")
    .map((line) => {
      const contact = line.match(/^(\s*联系人[：:])(.*)$/);
      if (contact) {
        const value = contact[2] ?? "";
        return `${contact[1]}${"*".repeat(Math.max(Array.from(value.trim()).length, 2))}`;
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

/** 游客：成果提交日期整段以 * 替换（长度对齐格式化后的日期） */
export function maskGuestBountyDeadline(formattedDate: string): string {
  return "*".repeat(Math.max(formattedDate.length, 8));
}
