type KnowingMarkProps = { size?: number; tone?: "default" | "inverse"; className?: string };

export function KnowingMark({ size = 32, tone = "default", className = "" }: KnowingMarkProps) {
  return (
    <svg className={`knowing-mark knowing-mark--${tone} ${className}`.trim()} width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Emojizzle" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="40" width="432" height="432" rx="108" fill="currentColor" />
      <g fill="none" stroke="var(--mark-feature)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M145 190c25-19 53-22 78-8" />
        <path d="M289 182c25-14 53-11 78 8" />
        <path d="M169 243c18-13 39-12 55 1" />
        <path d="M288 244c18-13 39-12 55 1" />
      </g>
      <path d="M211 335c35 26 75 25 108-3" fill="none" stroke="var(--mark-feature)" strokeWidth="22" strokeLinecap="round" />
    </svg>
  );
}
