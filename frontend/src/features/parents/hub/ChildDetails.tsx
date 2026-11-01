import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HeartHandshake } from 'lucide-react';
import { Section } from '../../../design/primitives';
import { FaceStack } from '../../../design/visuals';
import { PlayerCard } from '../../clubWorkspace/squads/PlayerCard';
import { PlayerIdentityEditor } from '../../players/PlayerIdentityEditor';
import { useClubCrest } from '../../squadCommunication/useClubCrest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { playerPath } from '../playerSelection';
import { PlayerLinkCode } from '../PlayerLinkCode';
import type { JoiningChild } from '../api';
import { ApproveAccount } from './ApproveAccount';
import { OwnAccount } from './OwnAccount';
import { firstName, playingClubs } from './childFacts';
import './parent-hub.css';

/**
 * A child's details, behind the page's one quiet link: the card the family keeps (photo, name, position; the birth date
 * is never shown), "Give … their own account" from 13, the linking code for a club that asks, and the family.
 */
export function ChildDetails({ child, onChanged }: { child: JoiningChild; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const [editing, setEditing] = useState(false);
    const clubs = playingClubs(child);
    const crest = useClubCrest(clubs[0]?.clubId);
    const born = child.identity.dateOfBirth ? new Date(child.identity.dateOfBirth) : null;
    const guardians = child.guardians ?? [];
    return <div className="ph-details" data-guide="child-details-view">
        <ApproveAccount key={`approve-${child.playerId}`} child={child} onChanged={onChanged} />
        <div className="ph-grid">
            <div className="ph-col ph-col--main">
                <Section boxed title={copy('Player card', 'მოთამაშის ბარათი')} className="ph-section ph-card"
                    action={child.identity.canEdit ? <button type="button" className="ph-link" aria-expanded={editing} onClick={() => setEditing(v => !v)}>{editing ? copy('Close', 'დახურვა') : copy('Edit', 'რედაქტირება')}</button> : undefined}>
                    {editing ? <PlayerIdentityEditor playerId={child.playerId} onSaved={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
                        : <div className="ph-card__face"><PlayerCard crest={crest} player={{ id: child.playerId, name: child.identity.fullName, position: child.identity.positions[0] ?? null, photoUrl: child.identity.photoUrl, age: born ? new Date().getFullYear() - born.getFullYear() : null }} />
                            <p className="ph-quiet">{copy('Yours to keep. Clubs see it while your child plays for them.', 'ბარათი თქვენია. კლუბები მას ხედავენ, სანამ ბავშვი მათთან თამაშობს.')}</p></div>}
                </Section>
            </div>
            <div className="ph-col ph-col--side">
                <OwnAccount key={`own-${child.playerId}`} child={child} onChanged={onChanged} />
                {!clubs.length && <PlayerLinkCode key={child.playerId} child={child} onChanged={onChanged} />}
                <Link className="ph-row ph-row--boxed" to={playerPath('/parent?tab=connections', child.playerId)}><span className="ph-row__icon" aria-hidden="true"><HeartHandshake /></span>
                    <span className="ph-row__text"><strong>{copy('Family & guardians', 'ოჯახი და მეურვეები')}</strong>
                        <small>{guardians.length ? guardians.map(g => g.self ? copy('You', 'თქვენ') : g.name.split(' ')[0]).join(' · ') : copy(`Who else looks after ${firstName(child)}, club consent`, `ვინ უვლის ${firstName(child)}-ს, კლუბის თანხმობა`)}</small></span>
                    {guardians.length > 0 && <FaceStack people={guardians.map(g => ({ id: g.id, name: g.name }))} size={24} />}<ArrowRight aria-hidden="true" /></Link>
            </div>
        </div>
    </div>;
}
