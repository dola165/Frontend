import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Tabs } from '../../design/Tabs';
import { Avatar, Badge, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchBoard, type Member, type WorkItem } from '../teamWork/api';
import { needsYou } from '../teamWork/needsYou';
import { TaskGroups } from '../teamWork/NowLists';
import { NowNoteCard } from '../teamWork/PersonView';
import { ago } from '../teamWork/teamWorkWords';
import type { ChatPerson } from './api';
import type { PersonTab } from './personTabs';

/**
 * A teammate, in a sheet over the chat (right-click a person, or press their name): who they are, their Team work
 * tasks, and their Now note with its comments. The address says what is open (?person=&ptab=), so the browser's Back
 * and Escape both return to the chat exactly as it was; opening a task from here goes to Team work, and Back comes
 * back here.
 */
export function PersonSheet({ personId, tab, people, me, onTab, onClose }: {
    personId: number; tab: PersonTab; people: ChatPerson[]; me: number | null; onTab: (tab: PersonTab) => void; onClose: () => void;
}) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [team, setTeam] = useState<Member[] | null>(null);
    const [items, setItems] = useState<WorkItem[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchBoard(controller.signal).then(board => { setTeam(board.team ?? []); setItems(board.items); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('Their work could not load.', 'მისი სამუშაო ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [copy]);
    const member = team?.find(one => one.userId === personId) ?? null;
    const known = people.find(one => one.id === personId);
    const name = member?.name ?? known?.name ?? copy('Teammate', 'გუნდის წევრი');
    const first = name.split(' ')[0];
    const theirs = items.filter(item => item.people.some(who => who.id === personId));
    const parentOf = new Map(items.map(item => [item.id, item]));
    const waiting = needsYou(theirs);
    const rest = theirs.filter(item => !waiting.includes(item));
    const groups: [string, WorkItem[]][] = [
        [copy('Needs a look', 'გელოდებათ'), waiting], [copy('In progress', 'მიმდინარე'), rest.filter(item => item.status === 'IN_PROGRESS')],
        [copy('Blocked', 'დაბლოკილი'), rest.filter(item => item.status === 'BLOCKED')], [copy('Planned', 'დაგეგმილი'), rest.filter(item => item.status === 'PLANNED')],
    ];
    const open = (task: number, step: number | null) => navigate(step ? `/team-work?task=${task}&step=${step}` : `/team-work?task=${task}`);
    const teamPeople = (team ?? []).map(one => ({ id: one.userId, name: one.name }));
    return <Dialog open size="sheet" className="tc-person" onClose={onClose} closeLabel={copy('Back to the chat', 'ჩატში დაბრუნება')}
        title={<span className="tc-person__title"><Avatar src={known?.avatarUrl} name={name} size={32} /><span>{name}</span></span>}
        description={member?.responsibility ?? undefined}>
        <Tabs<PersonTab> label={copy(`About ${name}`, `${name}-ის შესახებ`)} value={tab} onChange={onTab} idBase={`tc-person-${personId}`} items={[
            { id: 'profile', label: copy('Profile', 'პროფილი') },
            { id: 'tasks', label: copy('Tasks', 'საქმეები'), count: team ? theirs.filter(item => item.status !== 'ACCEPTED' && item.status !== 'LIVE' && item.status !== 'CANCELLED').length : undefined },
            { id: 'now', label: copy('Now', 'ახლა') },
        ]} />
        <div className="tc-person__body" role="tabpanel" id={`tc-person-${personId}-${tab}-panel`} aria-labelledby={`tc-person-${personId}-${tab}`}>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {!team && !error && <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={48} /><Skeleton height={48} /></div>}
            {team && tab === 'profile' && <dl className="tc-person__facts">
                <div><dt>{copy('Responsibility', 'პასუხისმგებლობა')}</dt><dd>{member?.responsibility ?? <span className="tc-faint">{copy('No responsibility written yet.', 'პასუხისმგებლობა ჯერ არ წერია.')}</span>}</dd></div>
                {member?.email && <div><dt>{copy('Email', 'ელფოსტა')}</dt><dd><a href={`mailto:${member.email}`}>{member.email}</a></dd></div>}
                {member?.admin && <div><dt>{copy('Role', 'როლი')}</dt><dd><Badge tone="info">{copy('Team admin', 'გუნდის ადმინი')}</Badge></dd></div>}
                <div><dt>{copy('Now', 'ახლა')}</dt><dd>{member?.now
                    ? <>{member.now}{member.nowAt && <span className="tc-faint"> · {ago(copy, member.nowAt)}</span>}</>
                    : <span className="tc-faint">{copy(`${first} hasn’t written what they’re doing yet.`, `${first}-ს ჯერ არ დაუწერია, რას აკეთებს.`)}</span>}</dd></div>
                <div><dt className="tc-sr">{copy('Full profile', 'სრული პროფილი')}</dt><dd><Link className="tc-link-button" to={`/profile/${personId}`}><ExternalLink aria-hidden="true" />{copy('Open the full profile', 'სრული პროფილის გახსნა')}</Link></dd></div>
            </dl>}
            {team && tab === 'tasks' && (groups.some(([, list]) => list.length > 0)
                ? <TaskGroups groups={groups} planOf={new Map()} parentOf={parentOf} onOpen={open} />
                : <p className="tc-faint">{copy(`Nothing open for ${first}.`, `${first}-ს ღია არაფერი აქვს.`)}</p>)}
            {team && tab === 'now' && <NowNoteCard person={{ id: personId, name }} team={teamPeople} me={me} />}
        </div>
    </Dialog>;
}
