/** 营业执照 OCR 识别结果 */
export type BusinessLicenseOcrResult = {
  companyName: string;
  creditCode: string;
  foundedYear: number;
  businessScope: string;
};

/** OCR 未接入时返回 null，需用户手动填写 */
export function recognizeBusinessLicense(): BusinessLicenseOcrResult | null {
  return null;
}
