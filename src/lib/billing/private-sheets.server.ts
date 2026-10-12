const raw = import.meta.glob("./sheets/*.b64", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

export function loadSheet(name: string): { mime: string; b64: string } | null {
  const key = name.split("/").join("__");
  const hit = Object.entries(raw).find(([path]) => path.endsWith(`/${key}.b64`));
  if (!hit) return null;
  const ext = name.split(".").pop() ?? "jpg";
  const b64 = hit[1].replace(/\s/g, "");
  return { mime: MIME[ext] ?? "application/octet-stream", b64 };
}
