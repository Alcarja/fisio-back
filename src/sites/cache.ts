// Tiny in-memory cache with a time limit, emptied per clinic by /_purge.
// One process, a few clinics: a Map is enough.

type Entry<T> = { value: T; expires: number; clinicId: string | null };

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 5000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  // clinicId: whose entry it is, so purge(clinicId) can drop it
  set(key: string, value: T, clinicId: string | null) {
    // Random hostnames could fill memory: drop the oldest when full
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs, clinicId });
  }

  purge(clinicId: string) {
    for (const [key, entry] of this.entries) {
      // Also "not found" entries: a newly published subdomain shows at once
      if (entry.clinicId === clinicId || entry.clinicId === null) this.entries.delete(key);
    }
  }
}
