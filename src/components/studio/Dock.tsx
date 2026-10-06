import { cn } from "@/lib/utils";
import { useCad } from "@/lib/cad/store";
import { MapsPanel } from "./MapsPanel";
import { ForensicPanel } from "./ForensicPanel";
import { SurveyMathPanel } from "./SurveyMathPanel";
import { VaultAudit } from "./VaultAudit";
import { AiPanel, Layers, Properties, Quantities, Survey } from "./DockPanels";

const TABS = ["properties", "layers", "maps", "forensic", "quantities", "survey", "ai"] as const;

export function Dock() {
  const tab = useCad((s) => s.rightTab);
  const setTab = useCad((s) => s.setRightTab);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface">
      <div className="flex shrink-0 flex-wrap gap-x-0 border-b border-border px-1" role="tablist" aria-label="Inspector">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "shrink-0 px-1.5 py-2 text-[10px] font-medium tracking-wide uppercase transition-colors duration-150",
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
        {tab === "forensic" && <ForensicDock />}
        {tab === "quantities" && <Quantities />}
        {tab === "survey" && <Survey />}
        {tab === "ai" && <AiPanel />}
      </div>
    </aside>
  );
}

export { AiPanel } from "./DockPanels";

const FORENSIC_SUBS = [
  { id: "topo", label: "ToPo" },
  { id: "vault", label: "Vault" },
  { id: "measure", label: "Measure" },
] as const;

function ForensicDock() {
  const sub = useCad((s) => s.forensicSub);
  const setSub = useCad((s) => s.setForensicSub);
  return (
    <div className="space-y-4">
      <div className="flex gap-1" role="tablist" aria-label="Forensic">
        {FORENSIC_SUBS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={sub === item.id}
            onClick={() => setSub(item.id)}
            className={cn(
              "rounded-sm px-2.5 py-1.5 text-[11px] tracking-wide",
              sub === item.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {sub === "topo" && <ForensicPanel part="topo" />}
      {sub === "vault" && <VaultAudit />}
      {sub === "measure" && (
        <div className="space-y-6">
          <ForensicPanel part="measure" />
          <SurveyMathPanel />
        </div>
      )}
    </div>
  );
}
