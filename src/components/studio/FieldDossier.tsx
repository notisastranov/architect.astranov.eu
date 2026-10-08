import { useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useCad } from "@/lib/cad/store";
import { authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { raiseFilm, raiseFilmStatus } from "@/lib/billing/api";

type Sheet = "topo" | "photo" | "film" | "wide";

const PIECES: { id: Sheet; label: string; kind: "img" | "video"; src: string; alt: string }[] = [
  { id: "topo", label: "Τοπογραφικό", kind: "img", src: "/marmarades/topo.jpg", alt: "Τοπογραφικό διάγραμμα Κ.Μ. 257 Γαιών Κοσκινού, 10 Απριλίου 2024" },
  { id: "photo", label: "Απεικόνιση", kind: "img", src: "/marmarades/house.jpg", alt: "Τελειωμένο δεντρόσπιτο στον ελαιώνα" },
  { id: "film", label: "Βίντεο", kind: "video", src: "/marmarades/film.mp4", alt: "Παρουσίαση από την αεροφωτογραφία στο κέντρο του χωραφιού" },
  { id: "wide", label: "Βίντεο 2", kind: "video", src: "/marmarades/film-wide.mp4", alt: "Παρουσίαση του τελειωμένου δεντρόσπιτου" },
];

function PinchImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const clamp = (n: number) => Math.max(1, Math.min(8, n));

  return (
    <div
      className="relative h-[68dvh] touch-none overflow-hidden bg-black"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, scale };
          drag.current = null;
          return;
        }
        drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      }}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
          setScale(clamp(pinch.current.scale * (dist / pinch.current.dist)));
          return;
        }
        const d = drag.current;
        if (!d || scale <= 1) return;
        setPos({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        drag.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
        drag.current = null;
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute top-1/2 left-1/2 max-w-none w-[100%] select-none"
        style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
      />
      <div className="absolute right-3 bottom-3 flex gap-2">
        <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => clamp(s / 1.4))} className="flex size-12 items-center justify-center rounded-sm bg-surface text-xl text-fg">
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setScale((s) => clamp(s * 1.4))}
          className="flex size-12 items-center justify-center rounded-sm bg-surface text-xl text-fg"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function FieldDossier() {
  const [open, setOpen] = useState<Sheet | null>(null);
  const [brief, setBrief] = useState("");
  const [made, setMade] = useState<string[]>([]);
  const [making, setMaking] = useState(false);
  const setView = useCad((s) => s.setView);
  const zoomExtents = useCad((s) => s.zoomExtents);
  const { user } = useCurrentUserState();
  const piece = PIECES.find((p) => p.id === open);

  const another = async () => {
    const text = brief.trim();
    if (!text || making) return;
    if (authEnabled && !user) {
      toast.error("Μπες με Google για να βγει νέο βίντεο.");
      void signIn("grok-google", { callbackURL: "/?from=spacenet" });
      return;
    }
    setMaking(true);
    try {
      const photoUrl = new URL("/marmarades/house.jpg", window.location.origin).href;
      const spacenet = localStorage.getItem("astranov-spacenet") === "1";
      const started = await raiseFilm({ data: { photoUrl, prompt: text, spacenet } });
      if (!started.ok || !("requestId" in started)) {
        const code = "code" in started ? started.code : "";
        toast.error(code === "unpaid" ? "Χρειάζεται πληρωμένη ώρα." : code === "spacenet" ? "Άνοιξέ το από το SpaceNet." : "error" in started ? started.error : "Δεν ξεκίνησε.");
        return;
      }
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const st = await raiseFilmStatus({ data: { requestId: started.requestId } });
        if (st.url) {
          setMade((list) => [...list, st.url]);
          setBrief("");
          toast.success("Το επόμενο βίντεο είναι έτοιμο.");
          return;
        }
        if (st.status === "failed" || st.status === "expired") break;
      }
      toast.error("Το βίντεο δεν πρόλαβε να τελειώσει.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Απέτυχε");
    } finally {
      setMaking(false);
    }
  };

  return (
    <>
      <div className="flex h-[104px] shrink-0 items-stretch gap-2 overflow-x-auto border-b border-border bg-surface px-2 py-1.5">
        <button
          type="button"
          onClick={() => {
            setView("plan");
            zoomExtents();
          }}
          className="flex w-28 shrink-0 flex-col justify-between rounded-sm border border-border bg-bg px-2 py-1.5 text-left hover:border-muted"
        >
          <span className="font-mono text-[10px] tracking-[0.14em] text-subtle">ΣΧΕΔΙΟ</span>
          <span className="text-xs leading-snug">Δεντρόσπιτο στο κέντρο της Κ.Μ. 257</span>
        </button>
        {PIECES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p.id)}
            className="group relative h-full shrink-0 overflow-hidden rounded-sm border border-border bg-bg"
          >
            {p.kind === "img" ? (
              <img src={p.src} alt={p.alt} className="h-full w-auto max-w-[280px] object-cover object-left" />
            ) : (
              <video src={p.src} poster="/marmarades/house.jpg" muted playsInline className="h-full w-40 object-cover" />
            )}
            <span className="absolute bottom-1 left-1 rounded-sm bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-fg">
              {p.label}
            </span>
          </button>
        ))}
        {made.map((src) => (
          <button key={src} type="button" onClick={() => setOpen("film")} className="relative h-full w-28 shrink-0 overflow-hidden rounded-sm border border-border">
            <video src={src} muted playsInline className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-1 rounded-sm bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] text-fg">Νέο</span>
          </button>
        ))}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void another();
        }}
      >
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Επόμενο βίντεο: τι να αλλάξει"
          className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-2 text-sm outline-none"
        />
        <button type="submit" disabled={making || !brief.trim()} className="h-11 shrink-0 rounded-sm bg-primary px-3 text-xs text-primary-fg disabled:opacity-40">
          {making ? "Γίνεται…" : "Νέο βίντεο"}
        </button>
      </form>
      {piece && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button type="button" className="absolute inset-0 bg-bg/85" aria-label="Κλείσιμο" onClick={() => setOpen(null)} />
          <div className="relative flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-xl bg-surface sm:rounded-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-mono text-[10px] tracking-[0.16em] text-subtle">Κ.Μ. 257 · ΜΑΡΜΑΡΑΔΕΣ</div>
                <h2 className="text-base font-medium">{piece.label}</h2>
              </div>
              <div className="flex items-center gap-2">
                {piece.id === "topo" && (
                  <a href="/marmarades/topo.pdf" download className="rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide text-muted uppercase hover:bg-elevated hover:text-fg">
                    PDF
                  </a>
                )}
                <button type="button" onClick={() => setOpen(null)} className="size-10 text-muted" aria-label="Κλείσιμο">
                  <X className="mx-auto size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-bg">
              {piece.kind === "img" ? (
                <PinchImage src={piece.src} alt={piece.alt} />
              ) : (
                <video src={piece.src} poster="/marmarades/house.jpg" controls autoPlay playsInline className="mx-auto max-h-[48dvh] w-full bg-black" />
              )}
              {piece.id === "topo" && <PinchImage src="/marmarades/ortho.png" alt="Αεροφωτογραφία του φύλλου" />}
              {piece.kind === "video" && (
                <div className="space-y-2 p-3">
                  {made.map((src) => (
                    <video key={src} src={src} controls playsInline className="max-h-[36dvh] w-full bg-black" />
                  ))}
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void another();
                    }}
                  >
                    <label className="font-mono text-[10px] tracking-[0.14em] text-subtle">ΕΠΟΜΕΝΟ ΒΙΝΤΕΟ</label>
                    <textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      rows={3}
                      placeholder="Γράψε τι να δείξει το επόμενο. Πιο κοντά στις ελιές, από το φύλλο στο σπίτι."
                      className="min-h-20 w-full rounded-sm bg-elevated px-2 py-2 text-sm outline-none"
                    />
                    <button type="submit" disabled={making || !brief.trim()} className="h-12 rounded-sm bg-primary text-sm text-primary-fg disabled:opacity-40">
                      {making ? "Το φτιάχνει…" : "Νέο βίντεο"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
