import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-xl bg-ink",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/fd-logo.png"
        alt="乐自由"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
      />
    </span>
  );
}
