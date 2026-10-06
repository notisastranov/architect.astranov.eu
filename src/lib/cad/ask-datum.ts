import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.string().max(12000),
  discipline: z.string().max(40),
  units: z.string().max(8),
});

export const askDatum = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; message: string; opsText: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    const system = `You are Architect, the draughtsman of Astranov Architect Forensic TopoBimCad — a precision CAD/BIM/survey modeller.
Internal units are millimetres. User-facing units: ${data.units}. Convert all sizes you emit into millimetres.
Discipline: ${data.discipline}.
Reply with a single JSON object:
{
  "message": "short confirmation",
  "ops": [ /* 0+ operations */ ]
}
Allowed ops (use only these):
- {"op":"addRectRoom","x":0,"y":0,"w":12000,"h":8000,"thickness":200,"wallHeight":3000,"name":"Living","material":"Brick"}
- {"op":"addWall","x1":0,"y1":0,"x2":4000,"y2":0,"thickness":200,"height":3000,"material":"Brick","name":"South"}
- {"op":"addDoor","wallId":"<id or south|north|east|west>","offset":1200,"width":900,"height":2100,"swing":"left","name":"D01"}
- {"op":"addWindow","wallId":"<id or south|north|east|west>","offset":2000,"width":1500,"height":1400,"sill":900,"name":"W01"}
- {"op":"addRect","x1":0,"y1":0,"x2":200,"y2":120,"thickness":12,"name":"Plate"}
- {"op":"addCircle","x":15,"y":15,"r":4,"name":"Ø8"}
- {"op":"addLine","x1":0,"y1":0,"x2":1000,"y2":0}
- {"op":"addColumn","x":0,"y":0,"width":300,"depth":300,"height":3000}
- {"op":"addSurvey","e":0,"n":0,"z":12450,"code":"STN1","desc":"SW station"}
- {"op":"addDim","x1":0,"y1":0,"x2":12000,"y2":0,"offset":-800}
- {"op":"addText","x":0,"y":-400,"text":"NOTE","size":200}
- {"op":"addRoom","name":"Kitchen","points":[{"x":0,"y":0},{"x":4000,"y":0},{"x":4000,"y":4000},{"x":0,"y":4000}]}
- {"op":"delete","ids":["id"]}
- {"op":"dimensionExtents"}
- {"op":"query","kind":"area"}
All coordinates millimetres. Prefer addRectRoom for enclosed rooms. Reuse existing wall ids when adding doors/windows. Do not invent units other than mm. Keep ops minimal and correct. If the user only asks a question, ops may be empty and message answers it using the model.`;

    const user = `CURRENT MODEL (mm):\n${data.model}\n\nREQUEST:\n${data.prompt}`;
    let text = "";
    if (apiKey) {
      // Host env key, when the deploy has one.
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.XAI_MODEL || "grok-4.5",
          temperature: 0.2,
          max_tokens: 1800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Model request failed (${res.status}).` };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      text = body.choices?.[0]?.message?.content ?? "";
    } else {
      // Same path as SpaceNet's /api/ai: the xAI key lives only in Supabase secrets and the
      // aicycle Edge Function makes the call. The current model rides in the system prompt
      // because aicycle trims the user message to 4000 characters.
      const r = await askViaSupabase(`${system}\n\nCURRENT MODEL (mm):\n${data.model}`, data.prompt);
      if (!r.ok) return r;
      text = r.text;
    }
    text = stripFences(text);
    try {
      const parsed = JSON.parse(text) as { message?: string; ops?: unknown };
      const ops = Array.isArray(parsed.ops) ? parsed.ops : [];
      return {
        ok: true,
        message: typeof parsed.message === "string" ? parsed.message : "Done.",
        opsText: JSON.stringify(ops),
      };
    } catch {
      return { ok: true, message: text.slice(0, 800) || "Done.", opsText: "[]" };
    }
  });

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://lkoatrkhuigdolnjsbie.supabase.co").replace(/\/+$/, "");

async function askViaSupabase(system: string, prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const anon = process.env.SUPABASE_ANON_KEY || "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55_000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/aicycle`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}),
      },
      body: JSON.stringify({ message: prompt, system, spacenet: true, fast: true, allow_paid: true, force_paid: true }),
    });
    if (!res.ok) return { ok: false, error: `AI request failed (${res.status}).` };
    const j = (await res.json().catch(() => ({}))) as { text?: string; response?: string; offline?: boolean };
    const text = String(j.text || j.response || "");
    if (!text || j.offline) return { ok: false, error: "AI is keyed in Supabase but the model did not answer. Try again." };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "AI timed out." : "AI request failed." };
  } finally {
    clearTimeout(timer);
  }
}

/** Models sometimes wrap JSON in ```json fences; keep the object inside. */
function stripFences(text: string) {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (m) return m[1]!;
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a > 0 && b > a && !t.startsWith("{") ? t.slice(a, b + 1) : t;
}
