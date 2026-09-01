/** 常规委托写入订单 description 的结构化区块解析 */

export interface ParsedEntrustContact {
  committerName?: string;
  contactName?: string;
  contactPhone?: string;
  projectCity?: string;
}

export interface ParsedEntrustBilling {
  billingModeRaw?: string;
  /** 计费区块内除标题外的明细行（已去掉空行） */
  detailLines: string[];
  valueAdded: string[];
}

export interface ParsedEntrustDescription {
  /** 用户填写的项目说明（区块标题之前） */
  brief: string;
  contact: ParsedEntrustContact | null;
  billing: ParsedEntrustBilling | null;
  /** 文末提示，如「平台将匹配设计师…」 */
  footerNote?: string;
  /** 未能按常规委托格式解析时，整段原文 */
  raw: string;
  structured: boolean;
}

const CONTACT_HEADER = "--- 委托联系信息 ---";
const BILLING_HEADER = "--- 计费摘要 ---";

const BILLING_MODE_LABEL: Record<string, string> = {
  daily: "按工时",
  monthly: "按月雇佣",
  area: "常规面积报价",
};

export function labelEntrustBillingMode(raw?: string): string {
  if (!raw) return "—";
  return BILLING_MODE_LABEL[raw] ?? raw;
}

function splitInlineContactKeys(text: string): string[] {
  return text
    .replace(/\s+(委托方：)/g, "\n$1")
    .replace(/\s+(联系人：)/g, "\n$1")
    .replace(/\s+(电话：)/g, "\n$1")
    .replace(/\s+(项目城市：)/g, "\n$1")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseKv(line: string, key: string): string | undefined {
  const prefix = `${key}：`;
  if (!line.startsWith(prefix)) return undefined;
  const v = line.slice(prefix.length).trim();
  return v || undefined;
}

function contactFromKvLines(lines: string[]): ParsedEntrustContact | null {
  const parsed: ParsedEntrustContact = {};
  for (const line of lines) {
    const committer = parseKv(line, "委托方");
    if (committer) {
      parsed.committerName = committer;
      continue;
    }
    const name = parseKv(line, "联系人");
    if (name) {
      parsed.contactName = name;
      continue;
    }
    const phone = parseKv(line, "电话");
    if (phone) {
      parsed.contactPhone = phone;
      continue;
    }
    const city = parseKv(line, "项目城市");
    if (city) parsed.projectCity = city;
  }
  if (
    parsed.committerName ||
    parsed.contactName ||
    parsed.contactPhone ||
    parsed.projectCity
  ) {
    return parsed;
  }
  return null;
}

/** 悬赏等未写区块标题的说明：从正文中抽出联系人 / 电话 / 项目城市 */
function extractLooseContact(text: string): {
  brief: string;
  contact: ParsedEntrustContact | null;
} {
  const keys = ["委托方：", "联系人：", "电话：", "项目城市："];
  const firstIdx = keys
    .map((k) => text.indexOf(k))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (firstIdx == null) {
    return { brief: text.trim(), contact: null };
  }

  const brief = text.slice(0, firstIdx).trim();
  return {
    brief,
    contact: contactFromKvLines(splitInlineContactKeys(text.slice(firstIdx))),
  };
}

/**
 * 解析 `buildRegularEntrustDescription` 生成的订单说明。
 * 非该格式时返回 structured: false，调用方应按原文展示。
 */
export function parseRegularEntrustDescription(
  description: string,
): ParsedEntrustDescription {
  const raw = description ?? "";
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text.includes(CONTACT_HEADER) && !text.includes(BILLING_HEADER)) {
    const loose = extractLooseContact(text);
    return {
      brief: loose.brief,
      contact: loose.contact,
      billing: null,
      raw,
      structured: Boolean(loose.contact),
    };
  }

  const contactIdx = text.indexOf(CONTACT_HEADER);
  const billingIdx = text.indexOf(BILLING_HEADER);

  const brief =
    contactIdx >= 0
      ? text.slice(0, contactIdx).trim()
      : billingIdx >= 0
        ? text.slice(0, billingIdx).trim()
        : text;

  let contact: ParsedEntrustContact | null = null;
  if (contactIdx >= 0) {
    const start = contactIdx + CONTACT_HEADER.length;
    const end = billingIdx >= 0 ? billingIdx : text.length;
    const section = text.slice(start, end).trim();
    const parsed = contactFromKvLines(splitInlineContactKeys(section));
    if (parsed) contact = parsed;
  }

  let billing: ParsedEntrustBilling | null = null;
  let footerNote: string | undefined;
  if (billingIdx >= 0) {
    const section = text.slice(billingIdx + BILLING_HEADER.length).trim();
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    const detailLines: string[] = [];
    const valueAdded: string[] = [];
    let billingModeRaw: string | undefined;

    for (const line of lines) {
      if (line.startsWith("平台将匹配") || line.startsWith("平台将")) {
        footerNote = line;
        continue;
      }
      const mode = parseKv(line, "计费方式");
      if (mode) {
        billingModeRaw = mode;
        continue;
      }
      if (line.startsWith("增值服务：")) {
        valueAdded.push(line.replace(/^增值服务：/, "").trim());
        continue;
      }
      if (line === "工时明细：") continue;
      detailLines.push(line.replace(/^·\s*/, ""));
    }

    billing = { billingModeRaw, detailLines, valueAdded };
  } else {
    const lastLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const last = lastLines[lastLines.length - 1];
    if (last?.startsWith("平台将")) footerNote = last;
  }

  return {
    brief,
    contact,
    billing,
    footerNote,
    raw,
    structured: Boolean(contact || billing),
  };
}

/** 只改项目备注，保留已解析的委托联系信息 */
export function replaceEntrustBrief(description: string, brief: string): string {
  const parsed = parseRegularEntrustDescription(description);
  const nextBrief = brief.trim();
  if (!parsed.contact) return nextBrief;
  return [
    nextBrief,
    "",
    CONTACT_HEADER,
    parsed.contact.committerName
      ? `委托方：${parsed.contact.committerName}`
      : null,
    parsed.contact.contactName ? `联系人：${parsed.contact.contactName}` : null,
    parsed.contact.contactPhone ? `电话：${parsed.contact.contactPhone}` : null,
    parsed.contact.projectCity ? `项目城市：${parsed.contact.projectCity}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
