"use client";

import { FileSignature } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentUploadSlot } from "@/components/domain/document-upload-slot";
import { mockRecognizeBusinessLicense } from "@/lib/business-license-ocr";

type Props = {
  uploaded: boolean;
  companyName: string;
  creditCode: string;
  foundedYear: number | "";
  businessScope: string;
  onUploadedChange: (uploaded: boolean) => void;
  onCompanyNameChange: (v: string) => void;
  onCreditCodeChange: (v: string) => void;
  onFoundedYearChange: (v: number | "") => void;
  onBusinessScopeChange: (v: string) => void;
  onRecognized?: () => void;
};

export function BusinessLicenseUploadSection({
  uploaded,
  companyName,
  creditCode,
  foundedYear,
  businessScope,
  onUploadedChange,
  onCompanyNameChange,
  onCreditCodeChange,
  onFoundedYearChange,
  onBusinessScopeChange,
  onRecognized,
}: Props) {
  const handleUpload = () => {
    const ocr = mockRecognizeBusinessLicense();
    onCompanyNameChange(ocr.companyName);
    onCreditCodeChange(ocr.creditCode);
    onFoundedYearChange(ocr.foundedYear);
    onBusinessScopeChange(ocr.businessScope);
    onUploadedChange(true);
    onRecognized?.();
  };

  const handleRemove = () => {
    onUploadedChange(false);
    onCompanyNameChange("");
    onCreditCodeChange("");
    onFoundedYearChange("");
    onBusinessScopeChange("");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>营业执照识别 *</Label>
        <p className="mt-1 text-xs text-ink-40">
          上传营业执照扫描件或高清照片，系统将自动识别公司名称、统一社会信用代码、创立时间与营业范围。
        </p>
        <DocumentUploadSlot
          className="mt-3"
          label="营业执照"
          uploaded={uploaded}
          fileName="营业执照_2026.pdf"
          icon={FileSignature}
          emptyHint="点击上传营业执照"
          onUpload={handleUpload}
          onRemove={handleRemove}
        />
      </div>

      {uploaded ? (
        <div className="space-y-4 rounded-xl border border-ink-20 bg-ink-20/15 p-4">
          <p className="text-xs font-medium text-ink-60">OCR 识别结果（可手动修正）</p>
          <div className="space-y-2">
            <Label>公司名称</Label>
            <Input
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="营业执照上的企业全称"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>统一社会信用代码</Label>
              <Input
                value={creditCode}
                onChange={(e) => onCreditCodeChange(e.target.value)}
                placeholder="18 位"
              />
            </div>
            <div className="space-y-2">
              <Label>创立时间</Label>
              <Input
                type="number"
                min={1980}
                max={new Date().getFullYear()}
                value={foundedYear}
                onChange={(e) =>
                  onFoundedYearChange(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="成立年份"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>营业范围</Label>
            <Textarea
              value={businessScope}
              onChange={(e) => onBusinessScopeChange(e.target.value)}
              rows={3}
              placeholder="营业执照登记的营业范围"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
