import { cn } from "@/lib/utils";
import { BOARD_IDS, type BoardId, useCad } from "@/lib/cad/store";
import { Viewport2D } from "./Viewport2D";
import { Viewport3D } from "./Viewport3D";
import { VaultAudit } from "./VaultAudit";

const LABEL: Record<BoardId, string> = {
  forensic: "Forensic",
  topo: "Topo",
  architect: "Architect",
  mechanic: "Mechanic",
  designer: "Designer",
  images: "AI images",
  videos: "AI videos",
};

export function ViewBoardBar() {
  const boards = useCad((s) => s.boards);
  const allOn = BOARD_IDS.every((id) => boards[id]);
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5">
      <button
        type="button"
        aria-pressed={allOn}
        onClick={() => useCad.getState().setAllBoards(true)}
        className={cn("h-9 shrink-0 rounded-sm px-2 text-[11px]", allOn ? "bg-primary text-primary-fg" : "bg-elevated text-muted")}
      >
        All
      </button>
      {BOARD_IDS.map((id) => {
        const on = boards[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => useCad.getState().toggleBoard(id)}
            className={cn("h-9 shrink-0 rounded-sm px-2 text-[11px]", on ? "bg-primary text-primary-fg" : "text-muted hover:bg-elevated")}
          >
            {on ? "On" : "Off"} {LABEL[id]}
          </button>
        );
      })}
    </div>
  );
}

export function BoardStage() {
  const boards = useCad((s) => s.boards);
  const images = useCad((s) => s.aiImages);
  const videos = useCad((s) => s.aiVideos);
  const on = BOARD_IDS.filter((id) => boards[id]);
  if (!on.length) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        Turn a view on. All shows every one together.
      </div>
    );
  }
  const cols = on.length === 1 ? 1 : 2;
  const rows = Math.ceil(on.length / cols);
  return (
    <div
      className="grid h-full min-h-0 min-w-0 gap-px overflow-hidden bg-border"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {on.map((id) => (
        <section key={id} className="relative min-h-0 min-w-0 overflow-hidden bg-bg">
          <span className="pointer-events-none absolute top-1 left-1 z-10 rounded-sm bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-fg">
            {LABEL[id]}
          </span>
          <Tile id={id} architectOn={boards.architect} images={images} videos={videos} />
        </section>
      ))}
    </div>
  );
}

function Tile({ id, architectOn, images, videos }: { id: BoardId; architectOn: boolean; images: string[]; videos: string[] }) {
  if (id === "forensic") {
    return architectOn ? (
      <div className="h-full overflow-auto pt-6">
        <VaultAudit />
      </div>
    ) : (
      <div className="h-full pt-5">
        <Viewport2D />
      </div>
    );
  }
  if (id === "architect") return <div className="h-full"><Viewport2D /></div>;
  if (id === "mechanic") return <div className="h-full"><Viewport3D /></div>;
  if (id === "topo") {
    return (
      <div className="flex h-full flex-col gap-1 overflow-auto pt-6">
        <img src="/marmarades/topo.jpg" alt="Τοπογραφικό Κ.Μ. 257" className="w-full object-contain" />
        <img src="/marmarades/ortho.png" alt="Αεροφωτογραφία" className="w-full object-contain" />
      </div>
    );
  }
  if (id === "designer") {
    return (
      <div className="flex h-full flex-col pt-6">
        <img src="/marmarades/house.jpg" alt="Σχέδιο δεντρόσπιτου" className="min-h-0 flex-1 object-contain" />
        <p className="shrink-0 px-2 py-1 text-[11px] text-muted">Ελιές ως κολώνες, δοκάρια 6 m, ραμποτέ, plexiglass, τζακούζι και πάνελ στη στέγη.</p>
      </div>
    );
  }
  if (id === "images") {
    return (
      <div className="flex h-full items-center gap-2 overflow-auto px-2 pt-6">
        {images.map((src) => (
          <img key={src} src={src} alt="AI image" className="h-[88%] w-auto shrink-0 object-contain" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full items-center gap-2 overflow-auto px-2 pt-6">
      {videos.map((src) => (
        <video key={src} src={src} poster="/marmarades/house.jpg" controls playsInline className="h-[88%] w-auto shrink-0 bg-black" />
      ))}
    </div>
  );
}
