import { redirect } from "next/navigation";

export default function NewBountyPage() {
  redirect("/entrust/new?mode=bounty");
}
