/** 平台所有附件的单文件上限 */
export const MAX_ATTACHMENT_BYTES = 500 * 1024 * 1024;
export const MAX_ATTACHMENT_LABEL = "500MB";

export function isAttachmentOversize(file: Pick<File, "size">) {
  return file.size > MAX_ATTACHMENT_BYTES;
}

export function findOversizedAttachment<T extends Pick<File, "name" | "size">>(
  files: T[],
): T | undefined {
  return files.find(isAttachmentOversize);
}

export function oversizedAttachmentMessage(fileName: string) {
  return `「${fileName}」超过 ${MAX_ATTACHMENT_LABEL}，请压缩后重试。`;
}
