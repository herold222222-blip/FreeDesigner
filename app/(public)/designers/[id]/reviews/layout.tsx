import { designers } from "@/mocks/designers";

export function generateStaticParams() {
  return designers.map((d) => ({ id: d.id }));
}

export default function DesignerReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
