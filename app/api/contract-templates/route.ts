import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import {
  getContractTemplates,
  saveContractTemplates,
} from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import type { ContractTemplatesConfig } from "@/lib/contract-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    return ok(await getContractTemplates());
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json()) as ContractTemplatesConfig;
    return ok(await saveContractTemplates(body));
  });
}
