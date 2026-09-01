import "../globals.css";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-white">
      <PublicHeader />
      <main className="min-w-0 flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
