import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function Skull({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Skull">
      <path d="M16 3.5C9.5 3.5 5.5 8 5.5 13.5C5.5 17 7 19.3 9.2 20.8V25C9.2 26.2 10 27.5 11.3 27.5H20.7C22 27.5 22.8 26.2 22.8 25V20.8C25 19.3 26.5 17 26.5 13.5C26.5 8 22.5 3.5 16 3.5Z" fill={visualColors.reactionPaper} stroke={visualColors.reactionInk} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="11.7" cy="14" r="3.2" fill={visualColors.reactionInk} />
      <circle cx="20.3" cy="14" r="3.2" fill={visualColors.reactionInk} />
      <path d="M16 17.5L14.4 20.5H17.6Z" fill={visualColors.reactionInk} />
      <path d="M13 23.5V27M16 23.5V27M19 23.5V27" stroke={visualColors.reactionInk} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
