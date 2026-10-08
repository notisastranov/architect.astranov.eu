export function BrandMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 5 V27 M5 16 H27 M8 8 L24 24 M24 8 L8 24" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export const PRODUCT_NAME = "Astranov Architect Forensic TopoBimCad";
export const PRODUCT_MARK = "ASTRANOV";
