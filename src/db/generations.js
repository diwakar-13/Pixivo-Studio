import { and, count, desc, eq, gte } from "drizzle-orm";

import { generations } from "@/db/schema";
import { db } from "@/db";

/** Start of current month (UTC), used for monthly generation quotas. */
export function utcMonthStart() {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

export async function countGenerationsSince(clerkUserId, since) {
  const [row] = await db
    .select({ c: count() })
    .from(generations)
    .where(
      and(
        eq(generations.clerkUserId, clerkUserId),
        gte(generations.createdAt, since)
      )
    );

  return Number(row?.c ?? 0);
}

export async function listUserGenerationSummaries(clerkUserId) {
  return db
    .select()
    .from(generations)
    .where(eq(generations.clerkUserId, clerkUserId))
    .orderBy(desc(generations.createdAt));
}

export async function createGeneration(input) {
  const [row] = await db
    .insert(generations)
    .values(input)
    .returning();

  return row;
}