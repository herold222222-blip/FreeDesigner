import { redirect } from "next/navigation";

/** 扫码下单列表已并入定向订单 */
export default function DesignerScanOrdersRedirectPage() {
  redirect("/designer/directed-orders");
}
