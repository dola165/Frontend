import { useId } from 'react';
import { Dialog } from '../../../../design/Dialog';
import { Skeleton } from '../../../../design/primitives';
import { Tabs } from '../../../../design/Tabs';
import { useJourneyCopy } from '../../../squadCommunication/journeyCopy';
import type { ClubEnquiryContext } from '../../publicJourney';
import type { ClubProfile } from '../types';
import { partsFor, startingPart, type JoinPart } from './joinFit';
import { ChildPart, HelpPart, PlayPart } from './JoinParts';
import { useJoinFacts } from './useJoinFacts';
import './join.css';

/**
 * Joining a club, from its page (the owner, 2 November 2026: World shows clubs the same for everyone; the real step is
 * here). Three parts in football words: Play (the squads that suit your age), My child (a squad for your child, then
 * the club's enquiry) and Help out (the club's open jobs and volunteering, and squads with no coach on its page). It
 * opens on the part for what the person said they came for (`startingPart`); under 18 only Play. The part shown is in the
 * address.
 */
export function ClubJoinDialog({ club, part, onPart, onClose, onContact, onChanged }: {
    club: ClubProfile;
    /** The part asked for in the address; none lets the pop-up choose. */ part: JoinPart | null;
    onPart: (part: JoinPart) => void; onClose: () => void;
    /** Opens the club's enquiry (a parent asking about a place for `playerId`, a question to the club). */ onContact: (context: ClubEnquiryContext, playerId?: number) => void;
    /** Something was sent: the club page reads the person's standing again. */ onChanged: () => void;
}) {
    const c = useJourneyCopy();
    const ids = useId();
    const facts = useJoinFacts(club.id);
    const parts = partsFor(facts.minor);
    const shown: JoinPart | null = part && parts.includes(part) ? part
        : facts.loading ? null
        : startingPart({ minor: facts.minor, choice: facts.choice, hasChildren: facts.children.length > 0 });
    const labels: Record<JoinPart, string> = { play: c('Play', 'თამაში'), child: c('My child', 'ჩემი შვილი'), help: c('Help out', 'დახმარება') };
    return (
        <Dialog open size="md" eyebrow={c('Join', 'გაწევრიანება')} title={club.name} onClose={onClose} closeLabel={c('Close', 'დახურვა')} className="gk-join">
            {parts.length > 1 && <Tabs className="gk-join__tabs" label={c('Join as', 'გაწევრიანება როგორც')} idBase={ids} value={shown ?? parts[0]} onChange={onPart}
                items={parts.map(id => ({ id, label: labels[id] }))} />}
            <div role={parts.length > 1 ? 'tabpanel' : undefined} id={parts.length > 1 ? `${ids}-${shown ?? parts[0]}-panel` : undefined}
                aria-labelledby={parts.length > 1 ? `${ids}-${shown ?? parts[0]}` : undefined} className="gk-join__part">
                {!shown || facts.loading ? <div className="gk-join__loading" role="status" aria-label={c('Loading…', 'იტვირთება…')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>
                    : shown === 'play' ? <PlayPart club={club} facts={facts} onContact={onContact} onChanged={onChanged} />
                    : shown === 'child' ? <ChildPart club={club} facts={facts} onContact={onContact} />
                    : <HelpPart club={club} facts={facts} onContact={onContact} />}
            </div>
        </Dialog>
    );
}
