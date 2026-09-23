import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
const DAY = 86400000;
export class StudioAuth {
  private failures = new Map<string, { attempts: number; until: number }>();
  private tokens = new Map<string, number>();
  constructor(
    private password: string,
    private now = Date.now,
  ) {}
  cleanup() {
    for (const [ip, s] of this.failures)
      if (s.until <= this.now()) this.failures.delete(ip);
    for (const [t, until] of this.tokens)
      if (until <= this.now()) this.tokens.delete(t);
  }
  unlock(ip: string, password: string) {
    this.cleanup();
    const f = this.failures.get(ip);
    if (f && f.attempts >= 2)
      return {
        status: "locked_out" as const,
        retryAfterMs: f.until - this.now(),
      };
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(digest(password), digest(this.password))) {
      const attempts = (f?.attempts ?? 0) + 1;
      this.failures.set(ip, { attempts, until: this.now() + DAY });
      return attempts >= 2
        ? { status: "locked_out" as const, retryAfterMs: DAY }
        : { status: "wrong" as const, attemptsRemaining: 2 - attempts };
    }
    this.failures.delete(ip);
    const token = randomBytes(32).toString("base64url");
    this.tokens.set(token, this.now() + 2 * 60 * 60 * 1000);
    return { status: "ok" as const, token };
  }
  authorized(token: string) {
    this.cleanup();
    return (this.tokens.get(token) ?? 0) > this.now();
  }
}
