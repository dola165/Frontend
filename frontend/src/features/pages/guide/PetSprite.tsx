/** Dola as the owner drew her in Figma: a pixel fox in the GrassKickZ hoodie. One grid per frame, a letter per pixel. */
const COLOURS: Record<string, string> = { d: '#9c4a2a', o: '#d9774b', c: '#f4dcbc', k: '#17171c', h: '#262a3d', w: '#eceae4', s: '#0d0d10' };
const HEAD = [
  '..dd......dd...',
  '..ddo....odd...',
  '..oooooooooo...',
  '.oooooooooooo..',
  '.ookkooookkoo..',
  '.ookkooookkoo..',
  '.occoooooocco..',
  '..cccckkcccc...',
];
const MOUTH = { shut: '...cccccccc....', open: '...ccckkccc....' };
const BODY = ['..hhhhhhhhhh...', '.hhhhhhhhhhhh..', 'chwwwwwwwwwwhc.', '.hhhhhhhhhhhh..', '..wwwwwwwwww...'];
const POINT_BODY = ['..hhhhhhhhhhhcc', '.hhhhhhhhhhhh..', '.hwwwwwwwwwwh..', '.hhhhhhhhhhhh..', '..wwwwwwwwww...'];
const LEGS = {
  stand: ['...hhh..hhh....', '...hhh..hhh....', '..sss....sss...'],
  stride: ['..hhh....hhh...', '.hhh......hhh..', '.ss........ss..'],
  pass: ['....hhhhhh.....', '.....hhhh......', '....ssssss.....'],
};
export type PetFrame = 'idle' | 'walk1' | 'walk2' | 'point' | 'talk';
const GRIDS: Record<PetFrame, string[]> = {
  idle: [...HEAD, MOUTH.shut, ...BODY, ...LEGS.stand],
  walk1: [...HEAD, MOUTH.shut, ...BODY, ...LEGS.stride],
  walk2: ['...............', ...HEAD, MOUTH.shut, ...BODY, ...LEGS.pass].slice(0, 17),
  point: [...HEAD, MOUTH.open, ...POINT_BODY, ...LEGS.stand],
  talk: [...HEAD, MOUTH.open, ...BODY, ...LEGS.stand],
};

export function PetSprite({ frame, className }: { frame: PetFrame; className?: string }) {
  return (
    <svg viewBox="0 0 15 17" className={className} shapeRendering="crispEdges" aria-hidden="true">
      {GRIDS[frame].flatMap((row, y) => [...row].map((cell, x) => (cell === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={COLOURS[cell]} />)))}
    </svg>
  );
}
