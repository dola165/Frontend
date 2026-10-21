import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function RedCard({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Red card">
      <g transform="rotate(12 16 16)">
        <rect x="8" y="3" width="16" height="26" rx="3" fill={visualColors.reactionRed} stroke={visualColors.reactionInk} strokeWidth="2" />
        <path d="M11.5 7.5V13" stroke={visualColors.reactionWhite} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
