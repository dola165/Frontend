import type { ReactNode } from 'react';

/**
 * The pictures on step 1's tiles, drawn rather than photographed (owner, 27 October): pitch lines and one football
 * symbol each, in the tile's own colour (`--wt`), so a tile is never empty. Purely decorative.
 */
export type TileArtKind = 'play' | 'club' | 'work' | 'business';

const PITCH = <g className="gk-wart__lines">
    <rect x="12" y="12" width="376" height="276" rx="6" />
    <line x1="200" y1="12" x2="200" y2="288" />
    <circle cx="200" cy="150" r="46" />
    <rect x="12" y="84" width="58" height="132" />
    <rect x="330" y="84" width="58" height="132" />
</g>;

const ART: Record<TileArtKind, ReactNode> = {
    // A ball over the pitch.
    play: <>{PITCH}<g className="gk-wart__mark" transform="translate(300 70)">
        <circle r="58" />
        <path d="M0 -20 L19 -6 L12 16 L-12 16 L-19 -6 Z" className="gk-wart__fill" />
        <path d="M0 -20 L0 -58 M19 -6 L55 -18 M12 16 L34 47 M-12 16 L-34 47 M-19 -6 L-55 -18" />
    </g></>,
    // A striped crest over the corner of a pitch.
    club: <><g className="gk-wart__lines">
        <path d="M12 220 A68 68 0 0 1 80 288" /><line x1="12" y1="12" x2="12" y2="288" /><line x1="12" y1="288" x2="388" y2="288" />
        <rect x="12" y="120" width="86" height="168" />
    </g><g className="gk-wart__mark" transform="translate(296 40)">
        <path d="M0 0 L74 22 L74 104 C74 150 40 176 0 196 C-40 176 -74 150 -74 104 L-74 22 Z" />
        <clipPath id="gk-wart-crest"><path d="M0 0 L74 22 L74 104 C74 150 40 176 0 196 C-40 176 -74 150 -74 104 L-74 22 Z" /></clipPath>
        <g clipPath="url(#gk-wart-crest)" className="gk-wart__fill"><rect x="-74" y="0" width="30" height="200" /><rect x="-14" y="0" width="28" height="200" /><rect x="44" y="0" width="30" height="200" /></g>
        <path d="M-40 70 L40 70" />
    </g></>,
    // A tactics board: players, a run and a pass.
    work: <><g className="gk-wart__lines"><rect x="12" y="12" width="376" height="276" rx="6" /><line x1="200" y1="12" x2="200" y2="288" /><circle cx="200" cy="150" r="40" /></g>
        <g className="gk-wart__mark">
            <circle cx="262" cy="70" r="13" className="gk-wart__fill" /><circle cx="330" cy="140" r="13" className="gk-wart__fill" /><circle cx="250" cy="200" r="13" className="gk-wart__fill" />
            <path d="M300 52 l18 18 m0 -18 l-18 18 M352 210 l18 18 m0 -18 l-18 18" />
            <path d="M262 84 C270 120 300 130 316 136" strokeDasharray="7 7" /><path d="M309 128 l9 8 l-11 4" />
            <path d="M264 196 C300 190 330 176 338 156" />
        </g></>,
    // A corner flag and a trophy.
    business: <><g className="gk-wart__lines"><path d="M388 220 A68 68 0 0 0 320 288" /><line x1="388" y1="12" x2="388" y2="288" /><line x1="12" y1="288" x2="388" y2="288" /></g>
        <g className="gk-wart__mark">
            <path d="M360 288 L360 150" /><path d="M360 150 L318 166 L360 182 Z" className="gk-wart__fill" />
            <path d="M250 40 L310 40 L306 92 C304 112 290 122 280 124 C270 122 256 112 254 92 Z" />
            <path d="M250 52 C226 52 228 86 254 88 M310 52 C334 52 332 86 306 88 M280 124 L280 150 M260 160 L300 160 L296 150 L264 150 Z" />
        </g></>,
};

export function WelcomeTileArt({ kind }: { kind: TileArtKind }) {
    return <svg className="gk-wart" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">{ART[kind]}</svg>;
}
