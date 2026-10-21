import { BOX, FRAMES, PALETTE } from './petFrames';

/** Dola as the owner drew her in Figma: a pixel fox in a green GrassKickZ jersey. One frame per pose. */
export type PetFrame = 'Idle · front' | 'Point · down' | 'Point · up' | 'Point · right' | 'Point · left' | 'Thinking' | 'Celebrate' | 'Wave'
  | `Walk ${'left' | 'right'} · ${'contact' | 'down' | 'passing' | 'up'}`;
export const WALK_STEPS = ['contact', 'down', 'passing', 'up'] as const;

const parsed = new Map<string, { rects: number[][]; words: number[] | null }>();
const frame = (name: PetFrame) => {
  let found = parsed.get(name);
  if (!found) {
    const source = FRAMES[name] ?? FRAMES['Idle · front'];
    found = { rects: source.rects.split(',').map(rect => rect.split(' ').map(Number)), words: source.words };
    parsed.set(name, found);
  }
  return found;
};

export function PetSprite({ frame: name, className }: { frame: PetFrame; className?: string }) {
  const { rects, words } = frame(name);
  return (
    <svg viewBox={BOX.join(' ')} className={className} shapeRendering="crispEdges" aria-hidden="true">
      {rects.map(([x, y, w, h, colour], index) => <rect key={index} x={x} y={y} width={w} height={h} fill={PALETTE[colour]} />)}
      {words && <text x={words[0] + words[2] / 2} y={words[1] + words[3] / 2} textAnchor="middle" dominantBaseline="central" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontWeight={700} fontSize={10} letterSpacing={0.6} fill={PALETTE[4]}>grasskickz</text>}
    </svg>
  );
}
