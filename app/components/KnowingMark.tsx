/* eslint-disable @next/next/no-img-element -- static exported public SVG asset */

type KnowingMarkProps = {
  size?: number;
  tone?: "default" | "inverse";
  className?: string;
  decorative?: boolean;
};

export function KnowingMark({
  size = 32,
  tone = "default",
  className = "",
  decorative = true,
}: KnowingMarkProps) {
  const src = tone === "inverse"
    ? "/brand/emojizzle-mark-inverse.svg"
    : "/brand/emojizzle-mark.svg";

  return (
    <img
      src={src}
      width={size}
      height={size}
      className={`knowing-mark ${className}`.trim()}
      alt={decorative ? "" : "Emojizzle"}
      aria-hidden={decorative ? "true" : undefined}
    />
  );
}
