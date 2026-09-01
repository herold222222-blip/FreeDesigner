/** 阶段成果：图片 / PDF / CAD / 压缩包 */

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const PDF_EXT = new Set([".pdf"]);
const CAD_EXT = new Set([".dwg", ".dxf", ".dgn"]);
const ARCHIVE_EXT = new Set([".zip", ".rar", ".7z"]);
const OFFICE_EXT = new Set([".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);

export const DELIVERABLE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".dwg",
  ".dxf",
  ".dgn",
  ".zip",
  ".rar",
  ".7z",
].join(",");

export const DELIVERABLE_TYPE_HINT =
  "图片（JPG / PNG / WebP / GIF）、PDF、CAD（DWG / DXF）或压缩包（ZIP / RAR / 7Z）";

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAllowedDeliverableFile(file: {
  name: string;
  type?: string | null;
}): boolean {
  const ext = fileExtension(file.name);
  const type = (file.type ?? "").toLowerCase();
  if (IMAGE_EXT.has(ext) || type.startsWith("image/")) return true;
  if (PDF_EXT.has(ext) || type === "application/pdf") return true;
  if (CAD_EXT.has(ext)) return true;
  if (
    ARCHIVE_EXT.has(ext) ||
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("7z")
  ) {
    return true;
  }
  return false;
}

export function inferDeliverableMime(file: {
  name: string;
  type?: string | null;
}): string {
  const type = (file.type ?? "").trim();
  if (type && type !== "application/octet-stream") return type;
  const ext = fileExtension(file.name);
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".dwg") return "application/acad";
  if (ext === ".dxf") return "image/vnd.dxf";
  if (ext === ".dgn") return "application/octet-stream";
  if (ext === ".zip") return "application/zip";
  if (ext === ".rar") return "application/vnd.rar";
  if (ext === ".7z") return "application/x-7z-compressed";
  return "application/octet-stream";
}

export function isImageDeliverable(file: {
  name: string;
  type?: string | null;
}): boolean {
  const ext = fileExtension(file.name);
  const type = (file.type ?? "").toLowerCase();
  return IMAGE_EXT.has(ext) || type.startsWith("image/");
}

export function isPdfDeliverable(file: {
  name: string;
  type?: string | null;
}): boolean {
  const ext = fileExtension(file.name);
  const type = (file.type ?? "").toLowerCase();
  return PDF_EXT.has(ext) || type === "application/pdf";
}

export function isOfficeDeliverable(file: {
  name: string;
  type?: string | null;
}): boolean {
  const ext = fileExtension(file.name);
  const type = (file.type ?? "").toLowerCase();
  return (
    OFFICE_EXT.has(ext) ||
    type.includes("msword") ||
    type.includes("officedocument") ||
    type.includes("ms-powerpoint") ||
    type.includes("presentationml") ||
    type.includes("ms-excel") ||
    type.includes("spreadsheetml")
  );
}

export function isPreviewableDeliverable(file: {
  name: string;
  type?: string | null;
}): boolean {
  return (
    isImageDeliverable(file) ||
    isPdfDeliverable(file) ||
    isOfficeDeliverable(file)
  );
}

export function officeEmbedSrc(href: string): string | null {
  if (!/^https?:\/\//i.test(href)) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(href)}`;
}

export function isCadDeliverable(file: { name: string }): boolean {
  return CAD_EXT.has(fileExtension(file.name));
}

export function isArchiveDeliverable(file: { name: string; type?: string | null }): boolean {
  const ext = fileExtension(file.name);
  const type = (file.type ?? "").toLowerCase();
  return (
    ARCHIVE_EXT.has(ext) ||
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("7z")
  );
}
