import { visualColors } from '../../../styles/visualColors';
import type { IconProps } from "./types"

export default function Fire({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Fire">
      <path d="M16 2.5C17 9 24.5 11 24.5 19.5C24.5 25.5 20.5 29.5 16 29.5C11.5 29.5 7.5 25.5 7.5 19.5C7.5 15.5 9.5 13.5 10.5 10.5C12 12.5 13.5 12.5 14 11C14.5 8 15 5 16 2.5Z" fill={visualColors.reactionOrange} stroke={visualColors.reactionInk} strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 17.5C17.5 19.5 20 21 20 24.5C20 27 18.2 28 16 28C13.8 28 12 27 12 24.5C12 21.5 14.5 20.5 16 17.5Z" fill={visualColors.reactionFlame} />
    </svg>
  )
}
