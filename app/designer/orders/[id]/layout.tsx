import { orders } from "@/mocks/orders";

/** 静态导出：与 client 详情页共用订单 id 列表 */
export function generateStaticParams() {
  return orders.map((o) => ({ id: o.id }));
}

export default function DesignerOrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
