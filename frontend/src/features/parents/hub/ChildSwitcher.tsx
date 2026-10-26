import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Avatar } from '../../../design/primitives';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useCanBeGuardian } from '../../../hooks/useCanBeGuardian';
import type { JoiningChild } from '../api';

const age = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null;
    const born = new Date(dateOfBirth), now = new Date();
    return now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
};

/**
 * Which child: one row of faces with each child's first name and where they play, the chosen one lit, and a "+"
 * for another child. On a phone it is one line that scrolls sideways.
 */
export function ChildSwitcher({ items, selectedId, onSelect, addTo }: { items: JoiningChild[]; selectedId?: number; onSelect: (id: number) => void; addTo: string }) {
    const copy = useJourneyCopy();
    const guardian = useCanBeGuardian();
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => { list.current?.querySelector('[aria-pressed=true]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [selectedId]);
    return <nav className="ph-switch" aria-label={copy('Choose a child', 'აირჩიეთ ბავშვი')}>
        <div ref={list} className="ph-switch__list">
            {items.map(child => {
                const years = age(child.identity.dateOfBirth);
                const where = child.clubs.length ? child.clubs.flatMap(club => club.squadNames.length ? club.squadNames : [club.clubName]).join(' · ') : copy('No club yet', 'კლუბი ჯერ არ არის');
                return <button key={child.playerId} type="button" className="ph-switch__child" aria-label={`${child.identity.fullName}, ${where}`} aria-pressed={child.playerId === selectedId} onClick={() => onSelect(child.playerId)}>
                    <Avatar src={resolveMediaUrl(child.identity.photoUrl) || null} name={child.identity.fullName} size={36} />
                    <span className="ph-switch__text"><strong>{child.identity.fullName.split(' ')[0]}{years != null && <span className="ph-switch__age">{years}</span>}</strong><small>{where}</small></span>
                </button>;
            })}
            {guardian.allowed && <Link className="ph-switch__add" to={addTo} aria-label={copy('Add a child', 'ბავშვის დამატება')} title={copy('Add a child', 'ბავშვის დამატება')}><Plus aria-hidden="true" /></Link>}
        </div>
    </nav>;
}
