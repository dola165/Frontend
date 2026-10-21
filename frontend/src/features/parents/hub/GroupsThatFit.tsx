import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Link2 } from 'lucide-react';
import { ButtonLink, Section, Skeleton } from '../../../design/primitives';
import { Crest } from '../../../design/visuals';
import { searchOpportunities } from '../../admissions/api';
import type { Opportunity } from '../../admissions/types';
import { useClubCrest } from '../../squadCommunication/useClubCrest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { playerPath } from '../playerSelection';
import type { JoiningChild } from '../api';

/**
 * A child with no squad yet: a few groups that take their age, each one press from asking to join, and the way to
 * all of them. A coach's join link is the other door, so it is named here too.
 */
export function GroupsThatFit({ child }: { child: JoiningChild }) {
    const copy = useJourneyCopy();
    const first = child.identity.fullName.split(' ')[0];
    const birthYear = child.identity.dateOfBirth ? Number(child.identity.dateOfBirth.slice(0, 4)) : undefined;
    const gender = child.identity.gender ?? undefined;
    const [groups, setGroups] = useState<Opportunity[] | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        searchOpportunities({ birthYear, gender, acceptingOnly: true, includeWaitlist: false, size: 4 }, abort.signal)
            .then(page => { if (!abort.signal.aborted) setGroups(page.items.slice(0, 4)); })
            .catch(() => { if (!abort.signal.aborted) setGroups([]); });
        return () => abort.abort();
    }, [birthYear, gender]);
    const all = playerPath('/world/opportunities?tab=groups', child.playerId);
    return <Section boxed title={copy(`Groups for ${first}`, `ჯგუფები ${first}-სთვის`)} hint={birthYear ? copy(`Born ${birthYear}, taking new players`, `დაბ. ${birthYear}, იღებენ ახალ მოთამაშეებს`) : undefined} className="ph-section ph-groups"
        action={<Link className="ph-link" to={all}>{copy('All groups', 'ყველა ჯგუფი')}</Link>}>
        {groups === null ? <Skeleton height={120} /> : groups.length ? <ul className="ph-rows">{groups.map(group => <GroupRow key={group.id} group={group} playerId={child.playerId} />)}</ul>
            : <p className="ph-quiet">{copy('No open groups for this age right now.', 'ამ ასაკისთვის ღია ჯგუფი ახლა არ არის.')} <Link className="ph-link" to={all}>{copy('Look on the map', 'ნახეთ რუკაზე')}</Link></p>}
        <p className="ph-groups__link"><Link2 aria-hidden="true" />{copy('Got a join link from a coach? Open it and pick your child.', 'მწვრთნელის ბმული გაქვთ? გახსენით და აირჩიეთ შვილი.')}</p>
        {groups !== null && !groups.length ? null : <ButtonLink className="ph-groups__all" size="sm" to={all}>{copy('Find a group', 'ჯგუფის მოძებნა')}</ButtonLink>}
    </Section>;
}

function GroupRow({ group, playerId }: { group: Opportunity; playerId: number }) {
    const copy = useJourneyCopy();
    const crest = useClubCrest(group.clubId ?? undefined);
    const fee = group.terms.charges[0];
    const cost = !group.terms.feesKnown ? null : fee ? `${fee.amount} ${fee.currency}` : copy('Free', 'უფასო');
    return <li><Link className="ph-row" to={playerPath(`/admissions/opportunities/${group.id}`, playerId)}>
        <Crest src={crest} name={group.organizationName} size={32} />
        <span className="ph-row__text"><strong>{group.name}</strong><small>{[group.organizationName, group.schedule, cost].filter(Boolean).join(' · ')}</small></span>
        <ArrowRight aria-hidden="true" />
    </Link></li>;
}
