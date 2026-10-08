import { useState } from "react";
import { X } from "lucide-react";
import { useCad } from "@/lib/cad/store";

type Sheet = "topo" | "photo" | "film" | "wide";

const PIECES: { id: Sheet; label: string; kind: "img" | "video"; src: string; alt: string }[] = [
  { id: "topo", label: "Τοπογραφικό", kind: "img", src: "/marmarades/topo.jpg", alt: "Τοπογραφικό διάγραμμα Κ.Μ. 257 Γαιών Κοσκινού, 10 Απριλίου 2024" },
  { id: "photo", label: "Απεικόνιση", kind: "img", src: "/marmarades/house.jpg", alt: "Τελειωμένο δεντρόσπιτο στον ελαιώνα" },
  { id: "film", label: "Βίντεο", kind: "video", src: "/marmarades/film.mp4", alt: "Παρουσίαση από την αεροφωτογραφία στο κέντρο του χωραφιού" },
  { id: "wide", label: "Βίντεο 2", kind: "video", src: "/marmarades/film-wide.mp4", alt: "Παρουσίαση του τελειωμένου δεντρόσπιτου" },
];

export function FieldDossier() {
  const [open, setOpen] = useState<Sheet | null>(null);
  const setView = useCad((s) => s.setView);
  const zoomExtents = useCad((s) => s.zoomExtents);
  const piece = PIECES.find((p) => p.id === open);

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
      </div>
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
            <div className="min-h-0 flex-1 overflow-auto bg-bg p-3">
              {piece.kind === "img" ? (
                <img
                  src={piece.src}
                  alt={piece.alt}
                  className={piece.id === "topo" ? "h-auto w-[2400px] max-w-none" : "mx-auto h-auto max-h-[78dvh] w-auto max-w-full"}
                />
              ) : (
                <video src={piece.src} poster="/marmarades/house.jpg" controls autoPlay playsInline className="mx-auto max-h-[78dvh] w-full bg-black" />
              )}
              {piece.id === "topo" && (
                <img src="/marmarades/ortho.png" alt="Αεροφωτογραφία του φύλλου" className="mx-auto mt-3 max-h-[50dvh] w-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
