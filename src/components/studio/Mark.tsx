export function BrandMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="4" y="12" width="24" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 12 L16 5 L28 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M16 5 V27" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 19 H22" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
