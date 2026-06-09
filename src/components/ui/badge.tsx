import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-white",
        outline: "border-ink-20 text-ink",
        muted: "border-transparent bg-ink-20/40 text-ink",
        brand: "border-transparent bg-brand text-white",
        amber: "border-transparent bg-amber-100 text-amber-800",
        emerald: "border-transparent bg-emerald-100 text-emerald-800",
        blue: "border-transparent bg-blue-100 text-blue-800",
        violet: "border-transparent bg-violet-100 text-violet-800",
        rose: "border-transparent bg-rose-100 text-rose-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
