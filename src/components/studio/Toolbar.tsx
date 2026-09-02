import {
  AppWindow,
  BoxSelect,
  Circle,
  Columns2,
  DoorOpen,
  Hand,
  Minus,
  MousePointer2,
  Pentagon,
  Ruler,
  Spline,
  Square,
  Type,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCad } from "@/lib/cad/store";
import type { Tool } from "@/lib/cad/types";

const ARCH: { id: Tool; label: string; hint: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", hint: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", hint: "H", icon: Hand },
  { id: "wall", label: "Wall", hint: "W", icon: Minus },
  { id: "door", label: "Door", hint: "D", icon: DoorOpen },
  { id: "window", label: "Window", hint: "I", icon: AppWindow },
  { id: "column", label: "Column", hint: "O", icon: Columns2 },
  { id: "room", label: "Room", hint: "R", icon: Pentagon },
  { id: "dim", label: "Dimension", hint: "Q", icon: Ruler },
  { id: "text", label: "Note", hint: "T", icon: Type },
];

const MECH: typeof ARCH = [
  { id: "select", label: "Select", hint: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", hint: "H", icon: Hand },
  { id: "line", label: "Line", hint: "L", icon: Minus },
  { id: "rect", label: "Plate", hint: "G", icon: Square },
  { id: "circle", label: "Hole", hint: "C", icon: Circle },
  { id: "dim", label: "Dimension", hint: "Q", icon: Ruler },
  { id: "text", label: "Note", hint: "T", icon: Type },
];

const SURV: typeof ARCH = [
  { id: "select", label: "Select", hint: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", hint: "H", icon: Hand },
  { id: "survey", label: "Station", hint: "P", icon: MapPin },
  { id: "line", label: "Traverse", hint: "L", icon: Spline },
  { id: "rect", label: "Footprint", hint: "G", icon: Square },
  { id: "measure", label: "Inverse", hint: "M", icon: Ruler },
  { id: "dim", label: "Dimension", hint: "Q", icon: BoxSelect },
  { id: "text", label: "Note", hint: "T", icon: Type },
];

export function Toolbar({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const tool = useCad((s) => s.tool);
  const setTool = useCad((s) => s.setTool);
  const disc = useCad((s) => s.project.discipline);
  const items = disc === "mechanical" ? MECH : disc === "survey" ? SURV : ARCH;

  return (
    <div
      className={cn(
        "flex gap-0.5",
        orientation === "vertical"
          ? "flex-col items-center py-1"
          : "w-full min-w-0 flex-row items-center overflow-x-auto px-1 py-1",
      )}
      role="toolbar"
      aria-label="Drawing tools"
    >
      {items.map((it) => {
        const Icon = it.icon;
        const on = tool === it.id;
        return (
          <button
            key={it.id}
            type="button"
            title={`${it.label} (${it.hint})`}
            aria-pressed={on}
            onClick={() => setTool(it.id)}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-150",
              orientation === "vertical" ? "size-11" : "size-10",
              on ? "bg-elevated text-fg" : "hover:bg-elevated/70 hover:text-fg",
            )}
          >
            <Icon className="size-4" strokeWidth={1.6} />
            <span className="sr-only">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
