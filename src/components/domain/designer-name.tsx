import type { Designer } from "@/lib/types";
import {
  designerGenderLabel,
  resolveDesignerGender,
  type DesignerGender,
} from "@/lib/designer-gender";
import { cn } from "@/lib/utils";

type DesignerNameProps = {
  designer: Pick<Designer, "name" | "subjectType" | "gender">;
  /** 对外展示用脱敏姓名（如 陈工），未传则使用 designer.name */
  displayName?: string;
  className?: string;
  nameClassName?: string;
  symbolClassName?: string;
};

function GenderSymbol({
  gender,
  className,
}: {
  gender: DesignerGender;
  className?: string;
}) {
  const isFemale = gender === "female";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "h-[1.2em] w-[1.2em] shrink-0",
        isFemale ? "text-red-600" : "text-blue-600",
        className,
      )}
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={designerGenderLabel(gender)}
    >
      {isFemale ? (
        <>
          <circle cx="12" cy="9" r="5" />
          <path d="M12 14v7" />
          <path d="M9 18h6" />
        </>
      ) : (
        <>
          <circle cx="10" cy="14" r="5" />
          <path d="M14 10l6-6" />
          <path d="M16 4h4v4" />
        </>
      )}
    </svg>
  );
}

export function DesignerName({
  designer,
  displayName,
  className,
  nameClassName,
  symbolClassName,
}: DesignerNameProps) {
  const gender = resolveDesignerGender(designer);
  const label = displayName ?? designer.name;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className={cn("truncate", nameClassName)}>{label}</span>
      {gender ? <GenderSymbol gender={gender} className={symbolClassName} /> : null}
    </span>
  );
}
