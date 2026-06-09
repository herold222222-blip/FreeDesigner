import { orders } from "@/mocks/orders";

/** 支付页占位路由与订单 id 对齐即可（静态托管下仍可用查询串 mock） */
export function generateStaticParams() {
  return orders.map((o) => ({ id: o.id }));
}

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
