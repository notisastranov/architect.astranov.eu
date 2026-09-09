import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, LockOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCad } from "@/lib/cad/store";
import { askDatum } from "@/lib/cad/ask-datum";
import { compactModel, inverse, quantities } from "@/lib/cad/quantities";
import { formatArea, formatMm, formatMmNum } from "@/lib/cad/units";
import { azimuthDeg, dist, formatDms, polygonArea, wallLength } from "@/lib/cad/geometry";
import type { AiOp, Entity, SurveyEnt, UnitSystem } from "@/lib/cad/types";
import { MATERIALS } from "@/lib/cad/types";
import { MapsPanel } from "./MapsPanel";

const TABS = ["properties", "layers", "maps", "quantities", "survey", "ai"] as const;

export function Dock() {
  const tab = useCad((s) => s.rightTab);
  const setTab = useCad((s) => s.setRightTab);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface">
      <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-border px-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 px-2 py-2.5 text-[10px] font-medium tracking-wide uppercase transition-colors duration-150",
              tab === t ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t === "ai" ? "AI" : t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
        {tab === "properties" && <Properties />}
        {tab === "layers" && <Layers />}
        {tab === "maps" && <MapsPanel />}
        {tab === "quantities" && <Quantities />}
        {tab === "survey" && <Survey />}
        {tab === "ai" && <AiPanel />}
      </div>
    </aside>
  );
}
