import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { member, user } from "../db/schema.js";

// Role a previous owner keeps when they aren't removed
const PREVIOUS_OWNER_ROLE = "admin";

// Runs after someone accepts an owner invitation: a clinic has one owner.
// - Super-admins who were owner (e.g. clinics created before owner invitations)
//   leave the clinic: they already see everything as super-admins.
// - Anyone else steps down to admin, so they don't lose access by surprise.
//   The new owner can remove them later.
export async function replacePreviousOwners(organizationId: string, newOwnerMemberId: string) {
  const previousOwners = await db
    .select({ memberId: member.id, platformRole: user.role })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.role, "owner"),
        ne(member.id, newOwnerMemberId),
      ),
    );

  await db.transaction(async (tx) => {
    for (const owner of previousOwners) {
      if (owner.platformRole === "superadmin") {
        await tx.delete(member).where(eq(member.id, owner.memberId));
      } else {
        await tx
          .update(member)
          .set({ role: PREVIOUS_OWNER_ROLE })
          .where(eq(member.id, owner.memberId));
      }
    }
  });
}
