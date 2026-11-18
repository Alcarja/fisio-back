import { Resolver } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { domainToASCII, domainToUnicode } from "node:url";
import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { clinicSiteDomain, member, organization, user } from "../db/schema.js";
import { sendTemplate } from "./email/index.js";
import { logError } from "./logError.js";
import { purgeSitesCache, siteBaseDomain } from "./sitesCache.js";

// Clinics' own domains (WEBS.md Phase 4). A clinic connects one domain; it
// gets two rows (activapilates.es and www.activapilates.es) with the same
// TXT token. A row is "verified" once the TXT record proves the clinic
// controls the DNS and the hostname points at our server. Only verified
// hostnames are served by the sites service (resolve.ts) and get a
// certificate from Caddy (/_domain-check).

// ---------- Configuration ----------

// The server's public addresses, which the clinic's A record must point at.
// Without SERVER_IPV4 the feature is off (Mi web shows "Muy pronto")
export const serverIpv4 = () => process.env.SERVER_IPV4?.trim() || null;
const serverIpv6 = () => process.env.SERVER_IPV6?.trim().toLowerCase() || null;
export const domainsConfigured = () => !!serverIpv4();

// ---------- Normalising what the clinic types ----------

// Endings with two labels (tuclinica.com.es): the domain then has three
const SECOND_LEVEL = new Set([
  "com.es", "org.es", "nom.es", "edu.es", "gob.es",
  "co.uk", "org.uk", "com.mx", "com.ar", "com.co", "com.pe", "com.br", "com.pt", "com.ve", "com.ec", "com.uy",
]);

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// "https://www.Clínica.es/contacto" → "xn--clnica-0ta.es" (the apex), or the
// problem in words for the clinic
export function parseDomain(input: unknown): { ok: true; apex: string } | { ok: false; error: string } {
  if (typeof input !== "string" || !input.trim()) return { ok: false, error: "Escribe tu dominio, por ejemplo tuclinica.es" };
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, ""); // scheme
  host = host.split(/[/?#]/)[0]!; // path, query
  host = host.replace(/:\d+$/, "").replace(/\.$/, ""); // port, trailing dot
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || IPV4.test(host) || host.includes(":")) return { ok: false, error: "Escribe un dominio, no una dirección IP" };

  const ascii = domainToASCII(host);
  if (!ascii || ascii.length > 253) return { ok: false, error: "Ese dominio no es válido" };
  const labels = ascii.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !/^[a-z]{2,63}$|^xn--/.test(labels.at(-1)!)) {
    return { ok: false, error: "Ese dominio no es válido" };
  }

  const base = siteBaseDomain();
  const ours = ["kineflow.es", base];
  if (ours.some((d) => ascii === d || ascii.endsWith(`.${d}`))) {
    return { ok: false, error: "Ese dominio es de Kineflow. Escribe el de tu clínica." };
  }

  const expected = SECOND_LEVEL.has(labels.slice(-2).join(".")) ? 3 : 2;
  if (labels.length !== expected) {
    return { ok: false, error: "Escribe el dominio principal, sin subdominios (por ejemplo tuclinica.es)" };
  }
  return { ok: true, apex: ascii };
}

export const newVerifyToken = () => `kf-${randomBytes(16).toString("hex")}`;

// ---------- The DNS check ----------

// Public resolvers, not the server's cache, so a fixed record shows at once
const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

export type DomainError = "TXT_MISSING" | "A_WRONG" | "AAAA_LEFTOVER" | "WWW_WRONG";

class DnsUnavailable extends Error {}

// No such record → empty; resolvers down or slow → DnsUnavailable (we don't
// mark a domain as broken because of our own network)
async function lookup<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") return [];
    throw new DnsUnavailable(code ?? "DNS");
  }
}

// What each hostname of a domain gets: null = OK, or the problem
export async function checkDns(apex: string, token: string): Promise<Record<string, DomainError | null>> {
  const ipv4 = serverIpv4();
  if (!ipv4) throw new Error("SERVER_IPV4 is not set");
  const ipv6 = serverIpv6();
  const www = `www.${apex}`;

  const [txt, apexA, apexAAAA, wwwA, wwwAAAA] = await Promise.all([
    lookup(() => resolver.resolveTxt(`_kineflow.${apex}`)),
    lookup(() => resolver.resolve4(apex)),
    lookup(() => resolver.resolve6(apex)),
    lookup(() => resolver.resolve4(www)),
    lookup(() => resolver.resolve6(www)),
  ]);

  const hasToken = txt.some((chunks) => chunks.join("").trim() === token);
  const leftoverV6 = (list: string[]) => list.length > 0 && !(ipv6 && list.map((a) => a.toLowerCase()).includes(ipv6));

  const apexProblem: DomainError | null = !hasToken
    ? "TXT_MISSING"
    : !apexA.includes(ipv4)
      ? "A_WRONG"
      : leftoverV6(apexAAAA)
        ? "AAAA_LEFTOVER"
        : null;
  const wwwProblem: DomainError | null = !hasToken
    ? "TXT_MISSING"
    : !wwwA.includes(ipv4)
      ? "WWW_WRONG"
      : leftoverV6(wwwAAAA)
        ? "AAAA_LEFTOVER"
        : null;
  return { [apex]: apexProblem, [www]: wwwProblem };
}

// ---------- Checking a clinic's domain and saving the result ----------

type Row = typeof clinicSiteDomain.$inferSelect;

const apexOf = (rows: Row[]) => rows.map((r) => r.hostname).sort((a, b) => a.length - b.length)[0]!;
const primaryOf = (rows: Row[]) => rows.find((r) => r.isPrimary)?.hostname ?? apexOf(rows);

// Days a verified domain may fail the daily check before it's marked as broken
const FAILING_DAYS_BEFORE_ERROR = 2; // the 3rd daily failure in a row

// Checks the clinic's domain now and saves each hostname's status. Emails the
// owners when it gets connected, or when a connected one breaks. Returns
// false if the DNS couldn't be asked (nothing changed)
export async function checkClinicDomain(clinicId: string, now = new Date()): Promise<boolean> {
  const rows = await db.select().from(clinicSiteDomain).where(eq(clinicSiteDomain.organizationId, clinicId));
  if (!rows.length) return true;
  const apex = apexOf(rows);

  let result: Record<string, DomainError | null>;
  try {
    result = await checkDns(apex, rows[0]!.verifyToken);
  } catch (error) {
    if (error instanceof DnsUnavailable) {
      console.warn(`[domains] DNS unavailable checking ${apex}: ${error.message}`);
      return false;
    }
    throw error;
  }

  let connected = false;
  let broken = false;
  for (const row of rows) {
    const problem = result[row.hostname] ?? "A_WRONG";
    const base = { lastCheckedAt: now, lastError: problem };
    if (!problem) {
      if (row.status !== "verified") connected = true;
      await db
        .update(clinicSiteDomain)
        .set({ ...base, status: "verified", verifiedAt: row.verifiedAt ?? now, failingSince: null })
        .where(eq(clinicSiteDomain.id, row.id));
    } else if (row.status === "verified") {
      // A connected domain gets a few days' grace: DNS changes and outages happen
      const failingSince = row.failingSince ?? now;
      const days = (now.getTime() - failingSince.getTime()) / 86_400_000;
      const giveUp = days >= FAILING_DAYS_BEFORE_ERROR - 0.01;
      if (giveUp) broken = true;
      await db
        .update(clinicSiteDomain)
        .set({ ...base, failingSince, status: giveUp ? "error" : "verified" })
        .where(eq(clinicSiteDomain.id, row.id));
    } else {
      await db.update(clinicSiteDomain).set({ ...base, status: "error" }).where(eq(clinicSiteDomain.id, row.id));
    }
  }

  if (connected || broken) await purgeSitesCache(clinicId);
  const primary = primaryOf(rows);
  if (connected && !result[primary]) await emailOwners(clinicId, "domainConnected", primary);
  if (broken) await emailOwners(clinicId, "domainBroken", primary);
  return true;
}

// ---------- Emails to the clinic's owners ----------

async function emailOwners(clinicId: string, template: "domainConnected" | "domainBroken" | "domainPending", domain: string) {
  const owners = await db
    .select({ email: user.email, name: user.name, clinicName: organization.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.organizationId, clinicId), eq(member.role, "owner")));
  const url = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/admin/website`;
  // Shown as the IDN (clínica.es), not punycode
  const shown = domainToUnicode(domain) || domain;
  for (const o of owners) {
    await sendTemplate(template, o.email, { name: o.name, clinicName: o.clinicName, domain: shown, url });
  }
}


// ---------- The periodic job ----------

const EVERY_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const LOCK = "hashtext('kineflow_domains')";

// Madrid's hour, for the once-a-day pass
const madridHour = (now: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(now));
const DAILY_HOUR = 6;

async function clinicsWith(where: ReturnType<typeof and>) {
  const rows = await db.selectDistinct({ id: clinicSiteDomain.organizationId }).from(clinicSiteDomain).where(where);
  return rows.map((r) => r.id);
}

export async function runDomainJobs(now = new Date(), { daily }: { daily: boolean }) {
  // Every 10 minutes: new domains (last 7 days) and broken ones that used to
  // work, so they come back quickly once fixed
  const recent = await clinicsWith(
    or(
      and(inArray(clinicSiteDomain.status, ["pending", "error"]), sql`${clinicSiteDomain.createdAt} > ${new Date(now.getTime() - 7 * DAY_MS)}`),
      and(eq(clinicSiteDomain.status, "error"), isNotNull(clinicSiteDomain.verifiedAt)),
    ),
  );
  const ids = new Set(recent);

  if (daily) {
    // Connected domains, to notice the ones that stop pointing at us
    for (const id of await clinicsWith(eq(clinicSiteDomain.status, "verified"))) ids.add(id);

    // Never connected: a reminder at 7 days, deleted at 30
    const neverConnected = and(inArray(clinicSiteDomain.status, ["pending", "error"]), isNull(clinicSiteDomain.verifiedAt));
    const remind = await db
      .selectDistinct({ id: clinicSiteDomain.organizationId, hostname: clinicSiteDomain.hostname })
      .from(clinicSiteDomain)
      .where(
        and(
          neverConnected,
          eq(clinicSiteDomain.isPrimary, true),
          sql`${clinicSiteDomain.createdAt} <= ${new Date(now.getTime() - 7 * DAY_MS)}`,
          sql`${clinicSiteDomain.createdAt} > ${new Date(now.getTime() - 8 * DAY_MS)}`,
        ),
      );
    for (const r of remind) await emailOwners(r.id, "domainPending", r.hostname);

    const stale = await db
      .delete(clinicSiteDomain)
      .where(and(neverConnected, lt(clinicSiteDomain.createdAt, new Date(now.getTime() - 30 * DAY_MS))))
      .returning({ hostname: clinicSiteDomain.hostname });
    if (stale.length) console.log(`[domains] removed ${stale.length} hostnames never connected in 30 days`);
  }

  let checked = 0;
  for (const id of ids) {
    try {
      if (await checkClinicDomain(id, now)) checked++;
    } catch (error) {
      logError(`[domains] check failed clinic=${id}`, error);
    }
  }
  return checked;
}

// Started from index.ts. Only on the server (CHECK_DOMAINS=true), and only
// one process at a time (advisory lock, like the reminders)
export function startDomainChecker() {
  if (process.env.CHECK_DOMAINS !== "true") {
    console.log("[domains] not checking from this server (CHECK_DOMAINS is not true)");
    return;
  }
  if (!domainsConfigured()) {
    console.warn("[domains] CHECK_DOMAINS=true but SERVER_IPV4 is not set: not checking");
    return;
  }
  let running = false;
  let lastDaily = "";
  const run = async () => {
    if (running) return;
    running = true;
    const client = await pool.connect().catch(() => null);
    try {
      if (!client) return;
      const { rows } = await client.query<{ locked: boolean }>(`select pg_try_advisory_lock(${LOCK}) as locked`);
      if (!rows[0]?.locked) return;
      try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const daily = madridHour(now) === DAILY_HOUR && lastDaily !== today;
        if (daily) lastDaily = today;
        const checked = await runDomainJobs(now, { daily });
        if (checked > 0) console.log(`[domains] ${checked} checked${daily ? " (daily pass)" : ""}`);
      } finally {
        await client.query(`select pg_advisory_unlock(${LOCK})`);
      }
    } catch (error) {
      logError("[domains] run failed", error);
    } finally {
      client?.release();
      running = false;
    }
  };
  setTimeout(run, 60_000);
  setInterval(run, EVERY_MS);
}
