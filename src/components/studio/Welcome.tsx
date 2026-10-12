import { useState } from "react";
import { toast } from "sonner";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";

const SPACENET = "https://astranov.eu";

export function Welcome({ onEnter }: { onEnter: () => void }) {
  const [mode, setMode] = useState<"in" | "up" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const account = async () => {
    if (!authEnabled) {
      toast.error("Η είσοδος δεν είναι ανοιχτή σε αυτή την προβολή.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await authClient.signUp.email({ email, password, name: name || email });
        if (error) throw new Error(error.message ?? "Ο λογαριασμός δεν άνοιξε.");
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Λάθος email ή κωδικός.");
      }
      onEnter();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Δεν μπήκες.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-medium">Astranov Architect</span>
        <a href={SPACENET} className="text-xs text-muted underline">
          SpaceNet · astranov.eu
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-5 pb-16">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-subtle">FORENSIC TOPOBIMCAD</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">The treehouse, drawn.</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Γράψε το όνομα και μπαίνεις κατευθείαν. Με Google, με λογαριασμό Astranov, ή από το SpaceNet.
            Το δεντρόσπιτο είναι η δημόσια επίδειξη. Η γη μένει κλειστή. Ο τόπος spacenet.astranov.eu
            δεν έχει ακόμα DNS· μέχρι να δεθεί το όνομα, το SpaceNet απαντά στο astranov.eu.
          </p>
        </div>
        <video src="/marmarades/iron-villa.mp4?v=3" controls playsInline preload="metadata" className="aspect-video w-full rounded-sm bg-black" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void signIn("grok-google", { callbackURL: "/" })}
            className="h-12 rounded-sm bg-primary px-4 text-sm text-primary-fg"
          >
            Google
          </button>
          <a href={SPACENET} className="flex h-12 items-center rounded-sm bg-elevated px-4 text-sm">
            SpaceNet
          </a>
          <button type="button" onClick={() => setMode("in")} className="h-12 rounded-sm bg-elevated px-4 text-sm">
            Λογαριασμός Astranov
          </button>
          <button type="button" onClick={onEnter} className="h-12 rounded-sm px-4 text-sm text-muted">
            Δες το δεντρόσπιτο
          </button>
        </div>
        {mode && (
          <form
            className="flex max-w-md flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void account();
            }}
          >
            {mode === "up" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα" className="h-12 rounded-sm bg-elevated px-3 text-sm outline-none" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" className="h-12 rounded-sm bg-elevated px-3 text-sm outline-none" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="Κωδικός, 8 χαρακτήρες" className="h-12 rounded-sm bg-elevated px-3 text-sm outline-none" />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="h-12 flex-1 rounded-sm bg-primary text-sm text-primary-fg disabled:opacity-40">
                {busy ? "…" : mode === "up" ? "Άνοιξε λογαριασμό" : "Μπες"}
              </button>
              <button type="button" onClick={() => setMode(mode === "up" ? "in" : "up")} className="h-12 rounded-sm px-3 text-xs text-muted">
                {mode === "up" ? "Έχω ήδη" : "Νέος λογαριασμός"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
