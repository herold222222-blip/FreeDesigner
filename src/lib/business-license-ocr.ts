/** 演示：营业执照 OCR 识别结果 */
export type BusinessLicenseOcrResult = {
  companyName: string;
  creditCode: string;
  foundedYear: number;
  businessScope: string;
};

/** 原型阶段固定演示识别结果（上传任意营业执照文件后自动填充） */
export const DEMO_BUSINESS_LICENSE_OCR: BusinessLicenseOcrResult = {
  companyName: "远境建筑设计有限公司",
  creditCode: "91310115MA1K3XXXXX",
  foundedYear: 2015,
  businessScope:
    "建筑工程设计；建筑装饰工程设计；风景园林工程设计；建筑智能化系统设计；建设工程项目管理；工程技术咨询。",
};

export function mockRecognizeBusinessLicense(): BusinessLicenseOcrResult {
  return { ...DEMO_BUSINESS_LICENSE_OCR };
}
