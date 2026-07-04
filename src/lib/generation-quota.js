import { countGenerationsSince, utcMonthStart } from "@/db/generations";

export const BILLING_PLAN_KEYS = {
  free: "free",
  pro: "pro",
  studio: "studio",
};

export const MONTHLY_GENERATION_LIMITS = {
  free: 3,
  pro: 50,
  studio: 150,
};

export function getMonthlyGenerationLimit(has) {
  if (has({ plan: BILLING_PLAN_KEYS.studio })) {
    return MONTHLY_GENERATION_LIMITS.studio;
  }
  if (has({ plan: BILLING_PLAN_KEYS.pro })) {
    return MONTHLY_GENERATION_LIMITS.pro;
  }
  return MONTHLY_GENERATION_LIMITS.free;
}

export async function getGenerationQuotaSnapshot(has, clerkUserId) {
  const limit = getMonthlyGenerationLimit(has);
  const used = await countGenerationsSince(clerkUserId, utcMonthStart());
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
