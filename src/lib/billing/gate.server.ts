import { getSql } from "@/lib/db";
import { DEV_USER_ID, authConfigured } from "@/lib/auth/verify.server";

export const HOUR_CENTS = 3300;

const OWNERS = new Set(["notisastranov@gmail.com", "info@astranov.eu"]);

export type GateOk = { ok: true; owner: boolean; balanceEur: number; passUntil: string | null };
export type GateNo = {
  ok: false;
  code: "spacenet" | "unpaid";
  balanceEur: number;
  hourEur: number;
  passUntil: string | null;
};

type Wallet = { balance_cents: number; pass_until: string | null; email: string | null };

function eur(cents: number) {
  return Math.round(cents) / 100;
}

export function isOwnerEmail(email: string | null, userId: string) {
  if (!authConfigured && userId === DEV_USER_ID) return true;
  if (!email) return false;
  const e = email.toLowerCase();
  return OWNERS.has(e) || e.endsWith("@astranov.eu");
}

async function emailOf(userId: string): Promise<string | null> {
  if (!authConfigured && userId === DEV_USER_ID) return "notisastranov@gmail.com";
  try {
    const sql = await getSql();
    const rows = await sql<{ email: string }>`select email from "user" where id = ${userId} limit 1`;
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

function asIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

async function wallet(userId: string, email: string | null): Promise<Wallet> {
  const sql = await getSql();
  const rows = await sql<{ balance_cents: number; pass_until: unknown; email: string | null }>`
    select balance_cents, pass_until, email from usage_wallet where user_id = ${userId}
  `;
  const row = rows[0];
  if (row) return { balance_cents: Number(row.balance_cents) || 0, pass_until: asIso(row.pass_until), email: row.email };
  await sql`insert into usage_wallet (user_id, email) values (${userId}, ${email}) on conflict (user_id) do nothing`;
  return { balance_cents: 0, pass_until: null, email };
}

function passOpen(until: string | null) {
  return Boolean(until && new Date(until).getTime() > Date.now());
}

export async function readAccess(userId: string) {
  const email = await emailOf(userId);
  const owner = isOwnerEmail(email, userId);
  const w = await wallet(userId, email);
  return {
    email,
    owner,
    balanceEur: eur(w.balance_cents),
    passUntil: w.pass_until,
    canFinish: owner || passOpen(w.pass_until),
    hourEur: HOUR_CENTS / 100,
  };
}

/** Opens a paid hour or refuses. The creator is never charged. */
export async function assertFinish(userId: string, spacenet: boolean): Promise<GateOk | GateNo> {
  const email = await emailOf(userId);
  const owner = isOwnerEmail(email, userId);
  const w = await wallet(userId, email);
  if (owner) return { ok: true, owner: true, balanceEur: eur(w.balance_cents), passUntil: w.pass_until };
  if (!spacenet) {
    return { ok: false, code: "spacenet", balanceEur: eur(w.balance_cents), hourEur: 33, passUntil: w.pass_until };
  }
  if (passOpen(w.pass_until)) {
    return { ok: true, owner: false, balanceEur: eur(w.balance_cents), passUntil: w.pass_until };
  }
  if (w.balance_cents < HOUR_CENTS) {
    return { ok: false, code: "unpaid", balanceEur: eur(w.balance_cents), hourEur: 33, passUntil: w.pass_until };
  }
  const sql = await getSql();
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sql`
    update usage_wallet
    set balance_cents = balance_cents - ${HOUR_CENTS}, pass_until = ${until}, email = ${email}, updated_at = now()
    where user_id = ${userId} and balance_cents >= ${HOUR_CENTS}
  `;
  await sql`insert into usage_ledger (user_id, kind, cents, note) values (${userId}, 'hour', ${-HOUR_CENTS}, '33 EUR hour')`;
  const next = await wallet(userId, email);
  if (!passOpen(next.pass_until)) {
    return { ok: false, code: "unpaid", balanceEur: eur(next.balance_cents), hourEur: 33, passUntil: next.pass_until };
  }
  return { ok: true, owner: false, balanceEur: eur(next.balance_cents), passUntil: next.pass_until };
}

export async function requestDeposit(userId: string, euros: number) {
  const email = await emailOf(userId);
  const cents = Math.round(euros * 100);
  const sql = await getSql();
  await wallet(userId, email);
  await sql`insert into deposit_requests (user_id, email, cents) values (${userId}, ${email}, ${cents})`;
  return { ok: true as const, status: "pending" as const };
}

export async function creditDeposit(ownerId: string, email: string, euros: number) {
  const ownerEmail = await emailOf(ownerId);
  if (!isOwnerEmail(ownerEmail, ownerId)) return { ok: false as const, error: "Μόνο ο δημιουργός περνάει κατάθεση." };
  const sql = await getSql();
  const found = await sql<{ id: string }>`select id from "user" where lower(email) = lower(${email}) limit 1`;
  const id = found[0]?.id;
  if (!id) return { ok: false as const, error: "Αυτό το email δεν έχει μπει ακόμη με Google." };
  const cents = Math.round(euros * 100);
  await sql`
    insert into usage_wallet (user_id, email, balance_cents)
    values (${id}, ${email}, ${cents})
    on conflict (user_id) do update
    set balance_cents = usage_wallet.balance_cents + ${cents}, email = ${email}, updated_at = now()
  `;
  await sql`insert into usage_ledger (user_id, kind, cents, note) values (${id}, 'deposit', ${cents}, ${email})`;
  return { ok: true as const };
}

async function xai(path: string, body: unknown) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Η τεχνητή νοημοσύνη δεν είναι διαθέσιμη.");
  const res = await fetch(`https://api.x.ai/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Το μοντέλο απάντησε ${res.status}.`);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function designFromSheet(input: { prompt: string; imageDataUrl?: string }) {
  const system = `You are Architect, the draughtsman of Astranov Architect Forensic TopoBimCad.
The user gives a topographic sheet or an aerial of their land, plus a short brief.
Design ONE buildable timber or stone building that sits inside the land, not on the road or the stream.
Internal units are millimetres.
Reply with a single JSON object:
{"message":"short Greek confirmation","photoPrompt":"one English sentence, photoreal finished building on that land, no people, no text","ops":[]}
Allowed ops only:
{"op":"addRectRoom","x":0,"y":0,"w":12000,"h":8000,"thickness":200,"wallHeight":3000,"name":"Living","material":"Stone"}
{"op":"addColumn","x":0,"y":0,"width":400,"depth":400,"height":3000}
{"op":"addText","x":0,"y":-400,"text":"NOTE","size":200}
{"op":"dimensionExtents"}
Keep the footprint modest and centred on 0,0.`;

  const userContent: unknown[] = [{ type: "text", text: input.prompt || "Σχεδίασε το κτίριο στο κέντρο του φύλλου." }];
  if (input.imageDataUrl?.startsWith("data:image/")) userContent.push({ type: "image_url", image_url: { url: input.imageDataUrl } });

  const body = await xai("/chat/completions", {
    model: "grok-4.5",
    temperature: 0.2,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });
  const choices = body.choices as { message?: { content?: string } }[] | undefined;
  const raw = choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { message?: string; photoPrompt?: string; ops?: unknown };
  const ops = Array.isArray(parsed.ops) ? parsed.ops : [];
  const photoPrompt =
    typeof parsed.photoPrompt === "string" && parsed.photoPrompt.trim()
      ? parsed.photoPrompt
      : "Photoreal finished building centred in an olive grove, late warm light, no people, no text.";

  let photoUrl = "";
  try {
    const editBody: Record<string, unknown> = {
      model: "grok-imagine-image-2.0",
      prompt: photoPrompt,
      aspect_ratio: "16:9",
      response_format: "url",
    };
    if (input.imageDataUrl?.startsWith("data:image/")) editBody.image = { url: input.imageDataUrl };
    const path = input.imageDataUrl ? "/images/edits" : "/images/generations";
    const img = await xai(path, editBody);
    const data = img.data as { url?: string }[] | undefined;
    photoUrl = data?.[0]?.url ?? "";
  } catch {
    const img = await xai("/images/generations", {
      model: "grok-imagine-image-2.0",
      prompt: photoPrompt,
      aspect_ratio: "16:9",
      response_format: "url",
    });
    const data = img.data as { url?: string }[] | undefined;
    photoUrl = data?.[0]?.url ?? "";
  }

  return {
    message: typeof parsed.message === "string" ? parsed.message : "Το κτίριο μπήκε στο φύλλο.",
    ops,
    photoUrl,
    photoPrompt,
  };
}

export async function startFilm(photoUrl: string, prompt: string) {
  const body = await xai("/videos/generations", {
    model: "grok-imagine-video-1.5-lite",
    prompt: prompt || "Slow move from the land onto the finished building. No people, no text.",
    image: { url: photoUrl },
    duration: 8,
    aspect_ratio: "16:9",
    resolution: "720p",
  });
  const requestId = typeof body.request_id === "string" ? body.request_id : "";
  if (!requestId) throw new Error("Το βίντεο δεν ξεκίνησε.");
  return { requestId };
}

export async function filmStatus(requestId: string) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Η τεχνητή νοημοσύνη δεν είναι διαθέσιμη.");
  const res = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await res.json()) as { status?: string; video?: { url?: string }; error?: string };
  if (!res.ok) throw new Error("Το βίντεο δεν απαντά.");
  return { status: body.status ?? "pending", url: body.video?.url ?? "" };
}
