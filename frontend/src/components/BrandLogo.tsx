/**
 * BrandLogo — ChroniNotes "CN" monogram, typography-first.
 *
 * Based on BrandLogoGradient: Sora weight-800, background-clip gradient fill.
 * No container, no tile, no border — just the lettermark.
 *
 * Two variants:
 *   "plain"    — solid --accent colour
 *   "gradient" — --logo-grad-start → --logo-grad-end (135°), default
 *
 * CSS vars (set per-theme in index.css):
 *   --logo-grad-start  falls back to --glow-a
 *   --logo-grad-end    falls back to --glow-b
 *
 * Props
 *   variant   "plain" | "gradient"   default "gradient"
 *   size      container height px    default 40
 *   animate   gentle floatY bob      default false
 *   className forwarded to root div
 *   style     forwarded to root div
 */

import type { CSSProperties } from "react"

export type LogoVariant = "plain" | "gradient"

interface BrandLogoProps {
  variant?: LogoVariant
  size?: number
  animate?: boolean
  className?: string
  style?: CSSProperties
}

export default function BrandLogo({
  variant = "gradient",
  size = 40,
  animate = false,
  className,
  style,
}: BrandLogoProps) {
  // Match the original formula exactly
  const fontSize = Math.max(18, Math.round(size * 0.62))

  const textStyle: CSSProperties =
    variant === "gradient"
      ? {
          backgroundImage:
            "linear-gradient(135deg, var(--logo-grad-start, var(--glow-a)), var(--logo-grad-end, var(--glow-b)))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }
      : {
          color: "var(--accent)",
        }

  return (
    <div
      aria-label="ChroniNotes"
      role="img"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        animation: animate ? "floatY 4s ease-in-out infinite" : undefined,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily:
            '"Sora", "Space Grotesk", "Manrope", "Inter", -apple-system, sans-serif',
          fontWeight: 800,
          fontSize,
          lineHeight: 1,
          letterSpacing: "-0.06em",
          userSelect: "none",
          display: "block",
          ...textStyle,
        }}
      >
        CN
      </span>
    </div>
  )
}
