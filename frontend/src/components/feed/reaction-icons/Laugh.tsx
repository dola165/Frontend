import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function Laugh({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Laughing">
      <circle cx="16" cy="16" r="13" fill={visualColors.reactionYellow} stroke={visualColors.reactionInk} strokeWidth="2" />
      <path d="M9 13.5Q11.5 10 14 13.5M18 13.5Q20.5 10 23 13.5" fill="none" stroke={visualColors.reactionInk} strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 18H22.5C22.5 23 19.8 26 16 26C12.2 26 9.5 23 9.5 18Z" fill={visualColors.reactionInk} />
      <path d="M12.5 24C13.5 22 18.5 22 19.5 24C18.5 25.5 13.5 25.5 12.5 24Z" fill={visualColors.reactionTongue} />
      <path d="M6 13C3.5 14 3 17.5 5 18.5C7 17.5 7.5 14 6 13ZM26 13C28.5 14 29 17.5 27 18.5C25 17.5 24.5 14 26 13Z" fill={visualColors.reactionBlue} stroke={visualColors.reactionInk} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
