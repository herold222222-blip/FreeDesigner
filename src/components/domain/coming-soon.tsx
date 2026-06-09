import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      <Card className="p-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-ink">Phase B 功能</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-60">{description}</p>
      </Card>
    </div>
  );
}
