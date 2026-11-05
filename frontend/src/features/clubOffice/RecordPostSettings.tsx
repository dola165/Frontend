import { BriefcaseBusiness, HeartHandshake, Medal, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { LoadFailed, Panel, Section, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useRecordPostSwitches, useRecordPostWords, type RecordPostKind } from './recordPostSwitches';
import './office.css';

const KINDS: Record<RecordPostKind, { icon: LucideIcon; title: [string, string]; hint: [string, string] }> = {
    TRIAL: { icon: UserPlus, title: ['Trials', 'სინჯები'], hint: ['When a trial opens', 'როცა სინჯები იხსნება'] },
    SQUAD: { icon: Users, title: ['Squads taking players', 'გუნდები, რომლებიც იღებენ მოთამაშეებს'], hint: ['When a squad starts taking players', 'როცა გუნდი მოთამაშეების მიღებას იწყებს'] },
    JOB: { icon: BriefcaseBusiness, title: ['Jobs and volunteering', 'სამუშაო და მოხალისეობა'], hint: ['When a job goes live', 'როცა ვაკანსია ქვეყნდება'] },
    PROJECT: { icon: HeartHandshake, title: ['Projects', 'პროექტები'], hint: ['When a fundraiser starts, passes halfway, reaches its goal or is done', 'როცა შემოწირულობა იწყება, ნახევარს აღწევს, მიზანს აღწევს ან სრულდება'] },
    TOURNAMENT: { icon: Medal, title: ['Tournaments', 'ტურნირები'], hint: ['When entries open, and the winners', 'როცა რეგისტრაცია იხსნება, და გამარჯვებულები'] },
    RESULTS: { icon: Medal, title: ['Results', 'შედეგები'], hint: ['Confirmed results, or 48 hours without a dispute', 'დადასტურებული შედეგები ან 48 საათი გასაჩივრების გარეშე'] },
    WEEKEND: { icon: Medal, title: ['This weekend', 'ამ შაბათ-კვირას'], hint: ['Friday at 09:00, Tbilisi time', 'პარასკევს 09:00-ზე, თბილისის დროით'] },
};

/** One switch per kind, with honest loading and failure; used in Club office › Settings and on the Posts tab. */
export function RecordPostSwitchList({ clubId }: { clubId: number }) {
    const copy = useJourneyCopy();
    const { title } = useRecordPostWords();
    const switches = useRecordPostSwitches(clubId);
    if (switches.failed && !switches.switches) return <LoadFailed text={copy('Couldn’t load', 'ვერ ჩაიტვირთა')} retry={copy('Try again', 'სცადეთ ხელახლა')} onRetry={switches.reload} />;
    if (!switches.switches) return <Panel padded><Skeleton height={160} /></Panel>;
    return <Panel flush>
        <ul className="office-settings__list" aria-label={title}>
            {switches.switches.kinds.map(({ kind, on }) => {
                const look = KINDS[kind];
                return <li className="office-settings__row" key={kind}>
                    <label className="office-settings__main office-settings__switch">
                        <span className="office-settings__icon"><look.icon aria-hidden="true" /></span>
                        <span className="office-settings__text"><strong>{copy(...look.title)}</strong><small>{copy(...look.hint)}</small></span>
                        <input type="checkbox" role="switch" className="gk-switch" checked={on} disabled={switches.busy || !switches.switches?.canChange}
                            onChange={event => void switches.toggle(kind, event.target.checked)} />
                    </label>
                </li>;
            })}
        </ul>
        {switches.changedElsewhere && <p role="status" className="gk-notice office-settings__rule">{copy('Someone changed these meanwhile. Here they are now.', 'ამასობაში ვიღაცამ შეცვალა. აი, ახლანდელი მდგომარეობა.')}</p>}
        {switches.failed && <p role="alert" className="gk-notice office-settings__rule">{copy('Couldn’t save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.')}</p>}
    </Panel>;
}

/**
 * Club office › Settings › Posts from the club's work (step 7): one switch per kind, all on. A careless club still
 * looks alive; switched off, a kind stops posting from then on and what it wrote stays.
 */
export function RecordPostSettings({ clubId }: { clubId: number }) {
    const { title, hint } = useRecordPostWords();
    return <Section title={title} hint={hint}><RecordPostSwitchList clubId={clubId} /></Section>;
}
