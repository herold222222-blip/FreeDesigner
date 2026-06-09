import { orders } from "@/mocks/orders";

/** 静态导出时需预生成路径；页面本身为客户端组件故放在 layout（服务端模块） */
export function generateStaticParams() {
  return orders.map((o) => ({ id: o.id }));
}

export default function ClientOrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
