import { orders } from "@/mocks/orders";

export function generateStaticParams() {
  const ids = new Set<string>();
  for (const o of orders) {
    const c = o.contractId?.trim();
    if (c) ids.add(c);
  }
  return [...ids].map((id) => ({ id }));
}

export default function ContractLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
