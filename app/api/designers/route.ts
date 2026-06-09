import { handle, ok } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { redactDesignerContactFields } from "@/lib/designer-contact-privacy";
import { listDesigners } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSessionUser();
    const viewer = session
      ? { role: session.role, identityId: session.identityId }
      : null;
    const designers = await listDesigners();
    return ok(
      designers.map((d) => redactDesignerContactFields(d, viewer)),
    );
  });
}
