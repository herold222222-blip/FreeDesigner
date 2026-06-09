import { handle, ok } from "@/lib/server/api";
import { listServiceProviders } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    return ok(await listServiceProviders());
  });
}
