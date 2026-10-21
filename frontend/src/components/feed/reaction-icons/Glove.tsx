import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function Glove({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Glove thumbs up">
      <rect x="11" y="3.5" width="7" height="15" rx="3.5" fill={visualColors.reactionGreen} stroke={visualColors.reactionInk} strokeWidth="2" />
      <rect x="9" y="14" width="19" height="14" rx="4.5" fill={visualColors.reactionGreen} stroke={visualColors.reactionInk} strokeWidth="2" />
      <path d="M28 18.5H23M28 23H23" stroke={visualColors.reactionInk} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.5 7V11" stroke={visualColors.reactionWhite} strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3.5" y="14" width="6" height="14" rx="2" fill={visualColors.reactionPaper} stroke={visualColors.reactionInk} strokeWidth="2" />
    </svg>
  )
}
