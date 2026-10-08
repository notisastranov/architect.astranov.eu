import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const Spacenet = z.object({ spacenet: z.boolean() });

export const accessState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { readAccess } = await import("./gate.server");
    return readAccess(context.userId);
  });

export const askDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ euros: z.union([z.literal(33), z.literal(66), z.literal(99)]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { requestDeposit } = await import("./gate.server");
    return requestDeposit(context.userId, data.euros);
  });

export const grantDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ email: z.string().email(), euros: z.number().int().min(33).max(990) }).parse(input))
  .handler(async ({ context, data }) => {
    const { creditDeposit } = await import("./gate.server");
    return creditDeposit(context.userId, data.email, data.euros);
  });

export const raiseBuilding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        prompt: z.string().max(2000),
        imageDataUrl: z.string().max(1_800_000).optional(),
        spacenet: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { assertFinish, designFromSheet } = await import("./gate.server");
    const gate = await assertFinish(context.userId, data.spacenet);
    if (!gate.ok) return gate;
    try {
      const made = await designFromSheet({ prompt: data.prompt, imageDataUrl: data.imageDataUrl });
      return { ok: true as const, ...made, balanceEur: gate.balanceEur, owner: gate.owner };
    } catch (err) {
      return { ok: false as const, code: "model" as const, error: err instanceof Error ? err.message : "Απέτυχε." };
    }
  });

export const raiseFilm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({ photoUrl: z.string().url().max(2000), prompt: z.string().max(500), spacenet: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { assertFinish, startFilm } = await import("./gate.server");
    const gate = await assertFinish(context.userId, data.spacenet);
    if (!gate.ok) return gate;
    try {
      const film = await startFilm(data.photoUrl, data.prompt);
      return { ok: true as const, ...film };
    } catch (err) {
      return { ok: false as const, code: "model" as const, error: err instanceof Error ? err.message : "Απέτυχε το βίντεο." };
    }
  });

export const raiseFilmStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ requestId: z.string().min(4).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { filmStatus } = await import("./gate.server");
    return filmStatus(data.requestId);
  });

export const finishGate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => Spacenet.parse(input))
  .handler(async ({ context, data }) => {
    const { assertFinish } = await import("./gate.server");
    return assertFinish(context.userId, data.spacenet);
  });
