import type { ArchitecturalDeclaration, SiteContext } from "./declaration";

declare module "./store" {
  interface CadState {
    site?: SiteContext;
    declaration?: ArchitecturalDeclaration;
  }
}
