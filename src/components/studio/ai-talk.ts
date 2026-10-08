import { toast } from "sonner";
import { askDatum } from "@/lib/cad/ask-datum";
import { compactModel } from "@/lib/cad/quantities";
import { BOARD_IDS, type BoardId, useCad } from "@/lib/cad/store";
import type { AiOp } from "@/lib/cad/types";
import { raiseFilm, raiseFilmStatus } from "@/lib/billing/api";

const BOARD_WORDS: { id: BoardId; words: string[] }[] = [
  { id: "forensic", words: ["forensic", "εγκληματο", "γωνι"] },
  { id: "topo", words: ["topo", "τοπογρ"] },
  { id: "architect", words: ["architect", "αρχιτεκτ"] },
  { id: "mechanic", words: ["mechanic", "μηχανο"] },
  { id: "designer", words: ["designer", "σχεδιαστ"] },
  { id: "images", words: ["images", "image", "εικον", "φωτο"] },
  { id: "videos", words: ["videos", "video", "βιντεο", "βίντεο"] },
];

function boardFrom(text: string): BoardId | null {
  const low = text.toLowerCase();
  return BOARD_WORDS.find((b) => b.words.some((w) => low.includes(w)))?.id ?? null;
}

function localOrder(text: string): boolean {
  const low = text.trim().toLowerCase();
  const st = useCad.getState();
  if (/^(all|ola|όλα|ολα)$/.test(low)) {
    st.setAllBoards(true);
    st.setStatus("Όλες οι όψεις ανοιχτές.");
    return true;
  }
  const weight = low.match(/^(weight|βάρος|βαρος)\s+([\d.]+)$/);
  if (weight) {
    st.setMeasureWeight(Number(weight[2]));
    st.setStatus(`Βάρος μέτρησης ${weight[2]}`);
    return true;
  }
  const toggle = low.match(/^(on|off|show|hide|άνοιξε|ανοιξε|κλείσε|κλεισε)\s+(.+)$/);
  if (toggle) {
    const id = boardFrom(toggle[2] ?? "");
    if (id) {
      const on = /^(on|show|άνοιξε|ανοιξε)$/.test(toggle[1] ?? "");
      if (st.boards[id] !== on) st.toggleBoard(id);
      st.setStatus(`${id} ${on ? "on" : "off"}`);
      return true;
    }
  }
  return false;
}

function takeLocal(op: AiOp): boolean {
  const st = useCad.getState();
  if (op.op === "boards") {
    st.setAllBoards(op.on !== false);
    return true;
  }
  if (op.op === "board") {
    const id = BOARD_IDS.find((b) => b === op.id);
    if (!id) return false;
    const on = op.on !== false;
    if (st.boards[id] !== on) st.toggleBoard(id);
    return true;
  }
  if (op.op === "weight" && typeof op.value === "number") {
    st.setMeasureWeight(op.value);
    return true;
  }
  if (op.op === "video" && typeof op.prompt === "string") {
    void anotherVideo(op.prompt);
    return true;
  }
  return false;
}

export async function anotherVideo(prompt: string) {
  const text = prompt.trim();
  if (!text) return;
  const photoUrl = new URL("/marmarades/house.jpg", window.location.origin).href;
  const spacenet = localStorage.getItem("astranov-spacenet") === "1";
  const started = await raiseFilm({ data: { photoUrl, prompt: text, spacenet } });
  if (!started.ok || !("requestId" in started)) {
    toast.error("error" in started ? started.error : "Το βίντεο δεν ξεκίνησε.");
    return;
  }
  toast.message("Το επόμενο βίντεο φτιάχνεται.");
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const row = await raiseFilmStatus({ data: { requestId: started.requestId } });
    if (row.url) {
      useCad.getState().pushAiMedia("videos", row.url);
      toast.success("Το βίντεο μπήκε στις όψεις.");
      return;
    }
    if (row.status === "failed" || row.status === "expired") break;
  }
  toast.error("Το βίντεο δεν πρόλαβε να τελειώσει.");
}

/** Talk to the designer. Short orders run locally. Everything else changes the model. */
export async function talk(raw: string, scope?: string) {
  const text = raw.trim();
  if (!text || useCad.getState().aiBusy) return;
  if (localOrder(text)) return;
  if (/^(βίντεο|βιντεο|video)\s*[:：]/.test(text)) {
    await anotherVideo(text.replace(/^(βίντεο|βιντεο|video)\s*[:：]\s*/i, ""));
    return;
  }
  const st = useCad.getState();
  st.pushAi("user", text);
  st.setAiBusy(true);
  st.setStatus("Η τεχνητή νοημοσύνη αλλάζει το σχέδιο…");
  try {
    const res = await askDatum({
      data: {
        prompt: scope ? `On the ${scope} view. ${text}` : text,
        model: compactModel(st.project).slice(0, 11000),
        discipline: st.project.discipline,
        units: st.units,
        spacenet: localStorage.getItem("astranov-spacenet") === "1",
      },
    });
    if (!res.ok) {
      st.pushAi("assistant", res.error);
      st.setStatus(res.error);
      toast.error(res.error);
      return;
    }
    let ops: AiOp[] = [];
    try {
      const parsed = JSON.parse(res.opsText) as unknown;
      if (Array.isArray(parsed)) ops = parsed as AiOp[];
    } catch {
      ops = [];
    }
    const drawing = ops.filter((op) => !takeLocal(op));
    if (drawing.length) useCad.getState().applyAi(drawing);
    useCad.getState().pushAi("assistant", res.message);
    useCad.getState().setStatus(res.message);
    toast.success(res.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Απέτυχε";
    useCad.getState().pushAi("assistant", msg);
    useCad.getState().setStatus(msg);
    toast.error(msg);
  } finally {
    useCad.getState().setAiBusy(false);
  }
}
