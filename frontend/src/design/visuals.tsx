import './visuals.css';
import type { CSSProperties } from 'react';
import { Avatar, type BadgeTone } from './primitives';

export interface Face { id: number | string; name: string; src?: string | null; tone?: BadgeTone }

/** A group as overlapping faces, each optionally ringed in a status colour, the rest as "+N". */
export function FaceStack({ people, max = 6, size = 28, label }: { people: Face[]; max?: number; size?: number; label?: string }) {
    const shown = people.slice(0, max), rest = people.length - shown.length;
    return <span className="gk-faces" role={label ? 'img' : undefined} aria-label={label} style={{ '--face': `${size}px` } as CSSProperties}>
        {shown.map(person => <span key={person.id} className="gk-faces__face" data-tone={person.tone} title={person.name}><Avatar name={person.name} src={person.src} size={size} /></span>)}
        {rest > 0 && <span className="gk-faces__more">+{rest}</span>}
    </span>;
}

/** Parts of a whole as one thin bar, each part in its status colour. */
export function SplitBar({ parts, label }: { parts: { value: number; tone: BadgeTone }[]; label: string }) {
    return <span className="gk-split" role="img" aria-label={label}>
        {parts.filter(part => part.value > 0).map((part, index) => <span key={index} data-tone={part.tone} style={{ flexGrow: part.value }} />)}
    </span>;
}

/** A club's crest, or its initials on a square tile when it has none. */
export function Crest({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
    return src ? <img className="gk-crest" src={src} alt="" width={size} height={size} loading="lazy" /> : <Avatar name={name} size={size} square />;
}

/** How much of a whole is done, as a small ring with the count inside. */
export function ProgressRing({ value, total, tone = 'accent', size = 34 }: { value: number; total: number; tone?: BadgeTone; size?: number }) {
    const share = total ? Math.min(1, value / total) : 0, radius = 15.5, length = 2 * Math.PI * radius;
    return <svg className="gk-ring" data-tone={tone} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} className="gk-ring__track" />
        <circle cx="18" cy="18" r={radius} className="gk-ring__value" strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 18 18)" />
        <text x="18" y="22" textAnchor="middle" className="gk-ring__text">{value}</text>
    </svg>;
}
