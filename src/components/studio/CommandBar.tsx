import { useRef } from "react";
import { useCad } from "@/lib/cad/store";
import { parseLength } from "@/lib/cad/units";
import { commitPolyline, tryCommandPoint } from "./Viewport2D";

export function CommandBar() {
  const command = useCad((s) => s.command);
  const setCommand = useCad((s) => s.setCommand);
  const status = useCad((s) => s.status);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (raw: string) => {
    const t = raw.trim();
    if (!t) {
      commitPolyline();
      return;
    }
    if (tryCommandPoint(t)) {
      setCommand("");
      return;
    }
    const st = useCad.getState();
    const cmd = t.toLowerCase();
    if (cmd === "u" || cmd === "undo") st.undo();
    else if (cmd === "redo") st.redo();
    else if (cmd === "z" || cmd === "zoom" || cmd === "zoom e" || cmd === "extents") st.zoomExtents();
    else if (cmd === "globe" || cmd === "earth" || cmd === "world") st.setView("globe");
    else if (cmd === "rhodes") {
      st.setView("globe");
      st.setGlobe({ lat: 36.434, lon: 28.217, flyNonce: st.globe.flyNonce + 1 });
    } else if (cmd === "ktima" || cmd === "ktimatologio") {
      st.setView("globe");
      st.setGlobe({ layer: "BASEMAP", flyNonce: st.globe.flyNonce + 1 });
    } else if (cmd === "ortho") st.setOrtho(!st.ortho);
    else if (cmd.startsWith("units ")) {
      const u = cmd.slice(6).trim();
      if (u === "mm" || u === "cm" || u === "m" || u === "ft") st.setUnits(u);
    } else if (st.draft?.tool === "text") {
      commitPolyline();
    } else if (cmd === "l" || cmd === "line") st.setTool("line");
    else if (cmd === "w" || cmd === "wall") st.setTool("wall");
    else if (cmd === "c" || cmd === "circle") st.setTool("circle");
    else if (cmd === "rec" || cmd === "rect") st.setTool("rect");
    else if (cmd === "dim") st.setTool("dim");
    else if (cmd === "del" || cmd === "erase") st.deleteSelection();
    else {
      const len = parseLength(t, st.units);
      if (len != null && st.draft?.points.length) {
        const a = st.draft.points[st.draft.points.length - 1]!;
        const b = st.hover ?? { x: a.x + len, y: a.y };
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const mag = Math.hypot(dx, dy) || 1;
        tryCommandPoint(`@${(len * dx) / mag / (st.units === "m" ? 1000 : st.units === "cm" ? 10 : 1)},${(len * dy) / mag / (st.units === "m" ? 1000 : st.units === "cm" ? 10 : 1)}`);
      } else {
        st.setStatus(`Unknown command: ${t}`);
      }
    }
    setCommand("");
  };

  return (
    <div className="flex h-[var(--height-cmd)] shrink-0 items-center gap-3 border-t border-border bg-surface px-3">
      <span className="hidden font-mono text-[10px] tracking-widest text-subtle uppercase sm:block">
        Command
      </span>
      <input
        ref={inputRef}
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            run(command);
          }
        }}
        placeholder={status}
        className="h-8 min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-fg placeholder:text-subtle outline-none"
        aria-label="Command line"
      />
    </div>
  );
}
