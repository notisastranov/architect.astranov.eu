import {
  DEFAULT_DECLARATION,
  DEFAULT_SITE,
  siteLine,
  type ArchitecturalDeclaration,
  type SiteContext,
} from "./declaration";
import { useCad } from "./store";
import { projectSite } from "@/lib/gis/site";

/** Declaration text per project id (session only). Nothing is prefilled: the form starts from the open project. */
const sites = new Map<string, Partial<SiteContext>>();
const declarations = new Map<string, Partial<ArchitecturalDeclaration>>();

export function getSite(): SiteContext {
  const p = useCad.getState().project;
  const at = projectSite(p);
  return { ...DEFAULT_SITE, ...sites.get(p.id), name: p.name, lat: at.lat, lon: at.lon };
}
export function getDeclaration(): ArchitecturalDeclaration {
  const p = useCad.getState().project;
  return { ...DEFAULT_DECLARATION, ...declarations.get(p.id) };
}
export function patchSite(patch: Partial<SiteContext>) {
  const st = useCad.getState();
  const { name, ...rest } = patch;
  if (name !== undefined) useCad.setState({ project: { ...st.project, name } });
  sites.set(st.project.id, { ...sites.get(st.project.id), ...rest });
}
export function patchDeclaration(patch: Partial<ArchitecturalDeclaration>) {
  const id = useCad.getState().project.id;
  declarations.set(id, { ...declarations.get(id), ...patch });
}
export function siteBrief() {
  const site = getSite();
  const dec = getDeclaration();
  return [siteLine(site), dec.title, dec.program, dec.statement].filter((x) => x && x.trim()).join("\n");
}
