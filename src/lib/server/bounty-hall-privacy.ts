import "server-only";
import type { SessionUser } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/repo";
import { isContractFullySigned } from "@/lib/order-lifecycle";
import { applyBountyPublicPrivacy } from "@/lib/bounty-privacy";
import type { Bounty } from "@/lib/types";

export async function isBountyAwardedContractSigned(bounty: Bounty): Promise<boolean> {
  if (!bounty.orderId || !bounty.awardedDesignerId) return false;
  const order = await getOrder(bounty.orderId);
  if (!order) return false;
  return isContractFullySigned(order);
}

export async function applyBountyPublicPrivacyWithContract(
  bounty: Bounty,
  session: SessionUser | null,
): Promise<Bounty> {
  const contractSigned =
    session?.role === "designer" &&
    session.identityId === bounty.awardedDesignerId
      ? await isBountyAwardedContractSigned(bounty)
      : false;
  return applyBountyPublicPrivacy(bounty, session, { contractSigned });
}

export async function applyBountyListPublicPrivacy(
  bounties: Bounty[],
  session: SessionUser | null,
): Promise<Bounty[]> {
  const signedOrderIds = new Set<string>();
  if (session?.role === "designer") {
    const ids = [
      ...new Set(
        bounties
          .filter(
            (b) =>
              b.awardedDesignerId === session.identityId && Boolean(b.orderId),
          )
          .map((b) => b.orderId!),
      ),
    ];
    const orders = await Promise.all(ids.map((id) => getOrder(id)));
    for (const order of orders) {
      if (order && isContractFullySigned(order)) signedOrderIds.add(order.id);
    }
  }
  return bounties.map((bounty) =>
    applyBountyPublicPrivacy(bounty, session, {
      contractSigned: Boolean(
        bounty.orderId && signedOrderIds.has(bounty.orderId),
      ),
    }),
  );
}
