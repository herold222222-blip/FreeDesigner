/** 支付页占位路由（运行时按 id 动态渲染） */
export function generateStaticParams() {
  return [];
}

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
