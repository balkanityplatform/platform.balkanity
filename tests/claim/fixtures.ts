// tests/claim/fixtures.ts — shared seed/teardown + caller-client helpers for the Phase 5
// live adversarial gates (concurrency.gate.test.ts, pii-payload.gate.test.ts).
//
// TWO CLIENT IDENTITIES, STRICTLY SEPARATED (threat T-05-03, D-04):
//   - SERVICE-ROLE (createAdminClient) — TEST-DB SEEDING + TEARDOWN ONLY. Builds the FK chain,
//     inserts the paid/unclaimed transfer, creates driver auth users. It NEVER calls
//     claim_transfer; the claim must run under a real driver JWT so auth.uid() is the driver.
//   - CALLER-AUTH (makeCallerClient) — the anon/publishable key + a per-driver JWT. This is the
//     ONLY identity the gates use to read wp_pool / wp_transfers and to call claim_transfer.
//
// The seed sets the FOUR PII fields (guest_name, guest_email, guest_phone, notes) on the paid
// row so the PII gate has real PII to (fail to) leak — the masked pool MUST omit them and the
// base table MUST return 0 rows to a non-claiming driver.
//
// LIVE-DB-GATED: every helper requires the live TEST-DB env (SUPABASE_SERVICE_ROLE_KEY +
// NEXT_PUBLIC_SUPABASE_URL + the anon/publishable key). When absent the helpers THROW a clear
// "live TEST-DB env required" — never a silent false-pass. The gates skip on that throw.
import { createClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/platform/supabase/admin";

// ---- Env (TEST DB only) -----------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Caller-auth clients use the publishable/anon key — never the service role.
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True when the live TEST-DB env is fully present. The gates branch on this to skip
 * (rather than false-pass) when run without a TEST DB.
 */
export function hasLiveEnv(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);
}

function requireLiveEnv(): {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
} {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    throw new Error(
      "live TEST-DB env required: set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, " +
        "and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before running the Phase 5 live gates.",
    );
  }
  return { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY, anonKey: ANON_KEY };
}

// ---- Types ------------------------------------------------------------------------------

export interface SeededTransfer {
  transferId: string;
  destinationId: string;
  propertyId: string;
  companyId: string;
}

export interface SeededDriver {
  userId: string;
  email: string;
  accessToken: string;
}

export interface SeedIds {
  transfer?: SeededTransfer;
  driverUserIds: string[];
}

// ---- Seed: a paid, unclaimed transfer with full PII ------------------------------------

/**
 * Build the minimal FK chain (company → property → active destination) and insert ONE
 * `wp_transfers` row with status='paid', driver_id=null, and the FOUR PII fields set, so the
 * PII gate has something to (fail to) leak. SERVICE-ROLE seeding only — never the claim path.
 * Returns the seeded ids for teardown.
 */
export async function seedPaidTransfer(): Promise<SeededTransfer> {
  requireLiveEnv();
  const admin = createAdminClient();

  const { data: company, error: companyErr } = await admin
    .from("companies")
    .insert({ name: `claim-gate-co-${crypto.randomUUID()}`, active: true })
    .select("id")
    .single();
  if (companyErr || !company) {
    throw new Error(`seed: company insert failed: ${companyErr?.message}`);
  }

  const { data: property, error: propertyErr } = await admin
    .from("properties")
    .insert({
      company_id: company.id,
      name: `claim-gate-prop-${crypto.randomUUID()}`,
      active: true,
    })
    .select("id")
    .single();
  if (propertyErr || !property) {
    throw new Error(`seed: property insert failed: ${propertyErr?.message}`);
  }

  const { data: destination, error: destErr } = await admin
    .from("destinations")
    .insert({
      property_id: property.id,
      slug: `claim-gate-${crypto.randomUUID()}`,
      label: "Claim Gate Destination",
      address: "12 Secret Exact Address St", // PII — must NEVER reach the pool/non-claiming driver
      zone: "Sunny Beach Area", // AREA only — this is the pool-safe coarse field (D-01)
      airport: "BOJ",
      price_cents: 4500,
      commission_pct: 10,
      active: true,
    })
    .select("id")
    .single();
  if (destErr || !destination) {
    throw new Error(`seed: destination insert failed: ${destErr?.message}`);
  }

  // ONE paid, unclaimed transfer with full PII set (the gate's target).
  const { data: transfer, error: transferErr } = await admin
    .from("wp_transfers")
    .insert({
      destination_id: destination.id,
      status: "paid",
      driver_id: null,
      amount_cents: 4500,
      currency: "eur",
      paid_at: new Date().toISOString(),
      arrival_at: new Date(Date.now() + 86_400_000).toISOString(),
      flight_no: "FR1234", // operational, EXPECTED present in the pool (D-02)
      pax: 2,
      luggage_count: 3,
      // --- the four PII fields the masked pool MUST omit and RLS MUST gate (D-01) ---
      guest_name: "Adversarial Guest",
      guest_email: `guest-${crypto.randomUUID()}@example.test`,
      guest_phone: "+359888000111",
      notes: "Leave a note here that must never leak to a non-claiming driver.",
    })
    .select("id")
    .single();
  if (transferErr || !transfer) {
    throw new Error(`seed: wp_transfers insert failed: ${transferErr?.message}`);
  }

  return {
    transferId: transfer.id,
    destinationId: destination.id,
    propertyId: property.id,
    companyId: company.id,
  };
}

// ---- Seed: N driver auth users + their JWTs --------------------------------------------

/**
 * Create N email-confirmed driver auth users via auth.admin.createUser, insert matching
 * app_users(role='driver') + driver_profiles rows, then sign each in to obtain an access_token.
 * Returns the N tokens + user ids. SERVICE-ROLE seeding only — the tokens are then used by
 * makeCallerClient to drive the caller-auth claim path.
 */
export async function seedDrivers(n: number): Promise<SeededDriver[]> {
  const { url, anonKey } = requireLiveEnv();
  const admin = createAdminClient();
  const password = `Claim-Gate-${crypto.randomUUID()}`;
  const drivers: SeededDriver[] = [];

  for (let i = 0; i < n; i++) {
    const email = `claim-driver-${crypto.randomUUID()}@example.test`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      throw new Error(`seed: driver createUser failed: ${createErr?.message}`);
    }
    const userId = created.user.id;

    const { error: appUserErr } = await admin
      .from("app_users")
      .insert({ id: userId, email, role: "driver" });
    if (appUserErr) {
      throw new Error(`seed: app_users insert failed: ${appUserErr.message}`);
    }

    const { error: profileErr } = await admin
      .from("driver_profiles")
      .insert({ user_id: userId, name: `Claim Driver ${i}`, phone: "+359888999000" });
    if (profileErr) {
      throw new Error(`seed: driver_profiles insert failed: ${profileErr.message}`);
    }

    // Sign in under the anon key to mint a real session/access_token (caller-auth identity).
    // The GoTrue token endpoint is IP-rate-limited; seeding many drivers across K rounds can
    // trip it. Retry with exponential backoff on the transient "rate limit" error so the gate
    // still mints a genuine per-driver JWT (the concurrency invariant is unchanged).
    const signInClient = createClient(url, anonKey);
    let accessToken: string | undefined;
    let lastErr: string | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: session, error: signInErr } =
        await signInClient.auth.signInWithPassword({ email, password });
      if (session?.session?.access_token) {
        accessToken = session.session.access_token;
        break;
      }
      lastErr = signInErr?.message;
      const isRateLimit = /rate limit/i.test(signInErr?.message ?? "");
      if (!isRateLimit) break;
      // 2s, 4s, 8s, 16s, 32s backoff — clears the GoTrue 5-min token window.
      await new Promise((r) => setTimeout(r, 2_000 * 2 ** attempt));
    }
    if (!accessToken) {
      throw new Error(`seed: driver sign-in failed: ${lastErr}`);
    }

    drivers.push({ userId, email, accessToken });
  }

  return drivers;
}

// ---- Caller-auth client (NEVER service-role) -------------------------------------------

/**
 * Return an anon/publishable-key supabase-js client with the given driver JWT attached, so
 * `auth.uid()` resolves to THAT driver inside claim_transfer and under wp_transfers RLS.
 * This is the ONLY identity the gates use for reads + the claim. NEVER service-role (D-04).
 */
export function makeCallerClient(token: string) {
  const { url, anonKey } = requireLiveEnv();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---- Teardown ---------------------------------------------------------------------------

/**
 * Delete everything the seed created (transfer → destination → property → company, and each
 * driver's driver_profiles/app_users/auth user). Service-role only. Leaves the live DB as
 * found, mirroring the 03-GATES-EVIDENCE cleanup. Errors are swallowed per-step so a partial
 * seed still tears down as much as possible.
 */
export async function teardown(ids: SeedIds): Promise<void> {
  requireLiveEnv();
  const admin = createAdminClient();

  if (ids.transfer) {
    const { transferId, destinationId, propertyId, companyId } = ids.transfer;
    await admin.from("wp_transfers").delete().eq("id", transferId);
    await admin.from("destinations").delete().eq("id", destinationId);
    await admin.from("properties").delete().eq("id", propertyId);
    await admin.from("companies").delete().eq("id", companyId);
  }

  for (const userId of ids.driverUserIds) {
    await admin.from("driver_profiles").delete().eq("user_id", userId);
    await admin.from("app_users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
