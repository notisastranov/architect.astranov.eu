import {
  DEFAULT_DECLARATION,
  DEFAULT_SITE,
  siteLine,
  type ArchitecturalDeclaration,
  type SiteContext,
} from "./declaration";

let site: SiteContext = { ...DEFAULT_SITE };
let declaration: ArchitecturalDeclaration = { ...DEFAULT_DECLARATION };

export function getSite() {
  return site;
}
export function getDeclaration() {
  return declaration;
}
export function patchSite(p: Partial<SiteContext>) {
  site = { ...site, ...p };
}
export function patchDeclaration(p: Partial<ArchitecturalDeclaration>) {
  declaration = { ...declaration, ...p };
}
export function siteBrief() {
  return `${siteLine(site)}\n${declaration.title}\n${declaration.program}\n${declaration.statement}`;
}
