type KnowingMarkProps = { size?: number; tone?: "default" | "inverse"; className?: string };

export function KnowingMark({ size = 32, tone = "default", className = "" }: KnowingMarkProps) {
  return (
    <svg className={`knowing-mark knowing-mark--${tone} ${className}`.trim()} width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Emojizzle" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="40" width="432" height="432" rx="108" fill="currentColor" />
      <g fill="none" stroke="var(--mark-feature)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M139 196c27-29 67-38 105-22" />
        <path d="M292 178c32-9 62 2 81 27" />
        <path d="M157 253c19-17 46-18 65-3" />
        <path d="M294 247c19-14 43-12 59 4" />
        <path d="M218 351c35 20 74 11 105-20" />
      </g>
      <path d="M204 254c9 13 23 19 38 15" fill="none" stroke="var(--mark-feature)" strokeWidth="18" strokeLinecap="round" />
      <circle cx="338" cy="252" r="7" fill="var(--mark-feature)" />
    </svg>
  );
}
