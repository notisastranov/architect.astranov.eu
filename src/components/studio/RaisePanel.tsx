import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useCad } from "@/lib/cad/store";
import type { AiOp } from "@/lib/cad/types";
import { accessState, askDeposit, grantDeposit, raiseBuilding, raiseFilm, raiseFilmStatus } from "@/lib/billing/api";

function cameFromSpaceNet() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("astranov-spacenet") === "1";
  } catch {
    return false;
  }
}

function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

export function RaisePanel() {
  const { user, isPending } = useCurrentUserState();
  const [spacenet, setSpacenet] = useState(false);
  const [access, setAccess] = useState<{ owner: boolean; balanceEur: number; canFinish: boolean; email: string | null } | null>(null);
  const [sheet, setSheet] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState("");
  const [film, setFilm] = useState("");
  const [note, setNote] = useState("Δεντρόσπιτο στο κέντρο, πάνω στις ελιές, χωρίς τοιχοποιία.");
  const [grantEmail, setGrantEmail] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = document.referrer;
    if (q.get("from") === "spacenet" || ref.includes("astranov.eu")) {
      localStorage.setItem("astranov-spacenet", "1");
    }
    setSpacenet(cameFromSpaceNet());
  }, []);

  useEffect(() => {
    if (!user) return;
    void accessState()
      .then((row) => setAccess(row))
      .catch(() => setAccess(null));
  }, [user]);

  const finish = async () => {
    if (!user || busy) return;
    if (!spacenet && !access?.owner) {
      toast.error("Άνοιξέ το από το SpaceNet, με το κουμπί A.");
      return;
    }
    setBusy(true);
    setFilm("");
    try {
      const res = await raiseBuilding({ data: { prompt: note, imageDataUrl: sheet, spacenet } });
      if (!res.ok) {
        if ("code" in res && res.code === "unpaid") toast.error(`Δεν τελειώνει. Χρειάζεται κατάθεση ${res.hourEur} € για μία ώρα.`);
        else if ("code" in res && res.code === "spacenet") toast.error("Πρώτα από το SpaceNet, μετά Google.");
        else toast.error("error" in res ? res.error : "Δεν ολοκληρώθηκε.");
        return;
      }
      const ops = (Array.isArray(res.ops) ? res.ops : []) as AiOp[];
      if (ops.length) useCad.getState().applyAi(ops);
      useCad.getState().setView("plan");
      if (res.photoUrl) {
        setPhoto(res.photoUrl);
        useCad.getState().pushAiMedia("images", res.photoUrl);
      }
      toast.success(res.message);
      if (res.photoUrl) {
        const started = await raiseFilm({ data: { photoUrl: res.photoUrl, prompt: res.photoPrompt, spacenet } });
        if (started.ok && "requestId" in started) {
          for (let i = 0; i < 24; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            const st = await raiseFilmStatus({ data: { requestId: started.requestId } });
            if (st.url) {
              setFilm(st.url);
              useCad.getState().pushAiMedia("videos", st.url);
              break;
            }
            if (st.status === "failed" || st.status === "expired") break;
          }
        }
      }
      const next = await accessState();
      setAccess(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Απέτυχε";
      toast.error(msg === "Unauthorized" ? "Μπες με Google." : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="shrink-0 border-b border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-subtle">33 € / ΩΡΑ</span>
        {isPending ? (
          <span className="text-xs text-muted">Λογαριασμός…</span>
        ) : !user || !authEnabled ? (
          <span className="text-xs text-muted">{access?.owner || !authEnabled ? "Δημιουργός, χωρίς χρέωση" : "Χωρίς λογαριασμό"}</span>
        ) : (
          <span className="text-xs text-muted">
            {access?.owner ? "Δημιουργός, χωρίς χρέωση" : `Υπόλοιπο ${access?.balanceEur ?? 0} €`}
            {user.primaryEmail ? ` · ${user.primaryEmail}` : ""}
          </span>
        )}
        {authEnabled && !user && !isPending && (
          <button type="button" onClick={() => void signIn("grok-google", { callbackURL: "/?from=spacenet" })} className="rounded-sm bg-primary px-2 py-1 text-xs text-primary-fg">
            Google
          </button>
        )}
        {!spacenet && (
          <a href="https://astranov.eu" className="rounded-sm px-2 py-1 text-xs text-muted underline">
            Άνοιγμα από το SpaceNet
          </a>
        )}
        <button type="button" onClick={() => useCad.getState().newProject("architecture")} className="rounded-sm px-2 py-1 text-xs text-muted hover:bg-elevated">
          Νέο δικό σου
        </button>
        {user && !access?.owner && (
          <button
            type="button"
            onClick={() => void askDeposit({ data: { euros: 33 } }).then(() => toast.success("Το αίτημα κατάθεσης 33 € γράφτηκε. Η ώρα ανοίγει όταν περάσει."))}
            className="rounded-sm px-2 py-1 text-xs text-muted hover:bg-elevated"
          >
            Αίτημα 33 €
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 min-w-0 flex-1 rounded-sm bg-elevated px-2 text-xs outline-none" />
        <label className="cursor-pointer rounded-sm bg-elevated px-2 py-2 text-xs text-muted">
          Τοπογραφικό ή αεροφωτογραφία
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.type === "application/pdf") {
                toast.error("Βάλε την εικόνα του φύλλου ή την αεροφωτογραφία. Το PDF είναι ήδη στο φύλλο.");
                return;
              }
              void shrinkImage(file).then(setSheet).catch(() => toast.error("Η εικόνα δεν διαβάστηκε."));
            }}
          />
        </label>
        <button type="button" disabled={busy || !user} onClick={() => void finish()} className="rounded-sm bg-primary px-3 py-2 text-xs text-primary-fg disabled:opacity-40">
          {busy ? "Το φτιάχνει…" : "Τέλειωσέ το"}
        </button>
      </div>
      {sheet && <p className="mt-1 text-[11px] text-subtle">Το φύλλο είναι έτοιμο. Η ολοκλήρωση βγάζει κτίριο, φωτογραφία και βίντεο.</p>}
      {(photo || film) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photo && <img src={photo} alt="Το κτίριο που έβγαλε η τεχνητή νοημοσύνη" className="h-28 w-auto rounded-sm" />}
          {film && <video src={film} controls playsInline className="h-28 w-auto rounded-sm bg-black" />}
        </div>
      )}
      {access?.owner && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void grantDeposit({ data: { email: grantEmail, euros: 33 } }).then((r) => {
              if (r.ok) toast.success("Η κατάθεση πέρασε.");
              else toast.error(r.error);
            });
          }}
        >
          <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="email κατάθεσης" className="h-8 rounded-sm bg-elevated px-2 text-xs outline-none" />
          <button type="submit" className="rounded-sm px-2 py-1 text-xs text-muted hover:bg-elevated">
            Πέρασμα 33 €
          </button>
        </form>
      )}
    </section>
  );
}
