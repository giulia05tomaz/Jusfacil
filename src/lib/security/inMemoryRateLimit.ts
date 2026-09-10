type RateLimitBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitResult = { allowed: boolean; retryAfter: number };

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// IN-MEMORY RATE LIMIT — DEVELOPMENT ONLY.
// Migrate to Firestore, Redis, or another shared store before multi-instance deployment.
export function checkInMemoryRateLimit(options: {
  namespace: "chat" | "draft" | "evidence";
  key: string;
  max: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = options.now ?? Date.now();
  const bucketKey = `${options.namespace}:${options.key}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= options.max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function checkChatRateLimit(uid: string, now?: number): RateLimitResult {
  return checkInMemoryRateLimit({
    namespace: "chat",
    key: uid,
    max: positiveInteger(process.env.OPENAI_CHAT_RATE_LIMIT_MAX, 12),
    windowMs: 60_000,
    now,
  });
}

export function checkDraftRateLimit(uid: string, caseId: string, now?: number): RateLimitResult {
  return checkInMemoryRateLimit({
    namespace: "draft",
    key: `${uid}:${caseId}`,
    max: positiveInteger(process.env.OPENAI_DRAFT_RATE_LIMIT_MAX, 3),
    windowMs: 60 * 60_000,
    now,
  });
}

export function checkEvidenceRateLimit(uid: string, caseId: string, now?: number): RateLimitResult {
  return checkInMemoryRateLimit({
    namespace: "evidence",
    key: `${uid}:${caseId}`,
    max: positiveInteger(process.env.OPENAI_EVIDENCE_RATE_LIMIT_MAX, 5),
    windowMs: 60 * 60_000,
    now,
  });
}

export function resetInMemoryRateLimitsForTests(): void {
  if (process.env.NODE_ENV === "test") buckets.clear();
}
