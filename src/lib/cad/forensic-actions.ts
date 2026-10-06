import { useCad } from "./store";

/** Start a Forensic pick from the dock or the command line. */
export function startForensicTool(kind: "length" | "angle" | "curve") {
  const st = useCad.getState();
  if (st.view === "globe" || st.view === "model") st.setView("plan");
  st.setRightTab("forensic");
  st.setForensicSub("measure");
  if (kind === "length") {
    st.setTool("measure");
    st.setStatus("Length · click two points. Chord and bearing (deg + DMS) appear in Forensic › Measure.");
    return;
  }
  st.setTool("polyline");
  st.setTracePick(kind);
  st.setStatus(kind === "angle" ? "Angle · click arm, vertex, arm (3 clicks)." : "Curve · click start, a point on the curve, end (3 clicks).");
}

/** Toggle every sheet between faint and strong so differences flash. Honest when there are none. */
export function blinkSheets() {
  const st = useCad.getState();
  if (st.overlays.length === 0) {
    st.setStatus("Blink · no sheets yet. Import a scan in Forensic › ToPo or Maps.");
    return;
  }
  st.overlays.forEach((s) => st.patchOverlay(s.id, { opacity: s.opacity > 0.4 ? 0.22 : 0.78 }));
  st.setStatus(`Blink · ${st.overlays.length} sheet${st.overlays.length === 1 ? "" : "s"} toggled`);
}
