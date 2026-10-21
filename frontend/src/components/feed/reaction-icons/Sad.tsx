import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function Sad({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Gutted">
      <circle cx="16" cy="16" r="13" fill={visualColors.reactionYellow} stroke={visualColors.reactionInk} strokeWidth="2" />
      <circle cx="11.5" cy="14.5" r="1.9" fill={visualColors.reactionInk} />
      <circle cx="20.5" cy="14.5" r="1.9" fill={visualColors.reactionInk} />
      <path d="M8.8 11L13.5 9.8M23.2 11L18.5 9.8M11 23.5Q16 19 21 23.5" fill="none" stroke={visualColors.reactionInk} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 17C19.3 19.2 19.3 21 21 21C22.7 21 22.7 19.2 21 17Z" fill={visualColors.reactionBlue} stroke={visualColors.reactionInk} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
