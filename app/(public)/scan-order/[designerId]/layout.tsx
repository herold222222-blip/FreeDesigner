import { designers } from "@/mocks/designers";

export function generateStaticParams() {
  return designers.map((d) => ({ designerId: d.id }));
}

export default function ScanOrderDesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
