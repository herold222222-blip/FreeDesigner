import { orders } from "@/mocks/orders";

export function generateStaticParams() {
  return orders.map((o) => ({ id: o.id }));
}

export default function SuperAdminOrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
