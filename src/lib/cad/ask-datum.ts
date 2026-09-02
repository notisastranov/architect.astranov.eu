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
    if (!apiKey) {
      return { ok: false, error: "AI is not available in this environment." };
    }

    const system = `You are Architect, the draughtsman of Astranov Architect BIMCAD — a precision CAD/BIM/survey modeller.
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

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `CURRENT MODEL (mm):\n${data.model}\n\nREQUEST:\n${data.prompt}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `Model request failed (${res.status}).` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
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
