import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button, GkRoot, List, ListRow, Panel, Section } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { HelperEmailWait } from '../../components/auth/EmailWait';
import { confirmationJobTitle, needsConfirmedEmail } from '../../components/auth/emailConfirmation';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { acceptHelpingProject, declineHelpingProject, fetchHelping, type HelpingProject } from './api';
import { dayWord, projectPath } from './projectWords';
import './projects.css';

/**
 * Home for a parent or volunteer on a project (phase B2): each project they help with, its club, and the steps waiting
 * on them, each a tap away. Nothing else of the club; nothing at all for someone on no project (or when Home couldn't
 * ask: the project is also in their Inbox). A new helper whose email waits sees "Confirm your email to see …"; an
 * existing account added by its address answers first: "Levan added you to New kit for U12 · Accept / Not for me".
 */
export function HelpingProjectsCard() {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<HelpingProject[]>([]);
    const [emailWait, setEmailWait] = useState<{ what: string | null } | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [round, setRound] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void fetchHelping(controller.signal).then(rows => { if (!controller.signal.aborted) setProjects(rows); })
            .catch(failure => { if (!controller.signal.aborted && needsConfirmedEmail(failure)) setEmailWait({ what: confirmationJobTitle(failure) }); });
        return () => controller.abort();
    }, [round]);
    const answer = async (project: HelpingProject, yes: boolean) => {
        setBusy(true); setError('');
        try {
            if (yes) { await acceptHelpingProject(project.projectId); navigate(projectPath(project.projectId)); }
            else { await declineHelpingProject(project.projectId); setRound(value => value + 1); }
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.'))); }
        finally { setBusy(false); }
    };
    if (emailWait) return <GkRoot><HelperEmailWait what={emailWait.what} next="/home" /></GkRoot>;
    if (!projects.length) return null;
    return <GkRoot><Section boxed title={copy('Your projects', 'თქვენი პროექტები')} className="pj-helping">
        <Panel flush><List label={copy('Your projects', 'თქვენი პროექტები')}>{projects.map(project => project.pending
            ? <ListRow key={project.projectId} lead={<Crest src={project.club?.crestUrl ?? null} name={project.club?.name ?? ''} size={32} />}
                title={copy(`${project.addedBy ?? project.club?.name ?? 'The club'} added you to ${project.goal}`, `${project.addedBy ?? project.club?.name ?? 'კლუბმა'} დაგამატათ: ${project.goal}`)}
                meta={project.club?.name}
                trail={<span className="pj-ask"><Button size="sm" variant="primary" disabled={busy} onClick={() => void answer(project, true)}>{copy('Accept', 'მიღება')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void answer(project, false)}>{copy('Not for me', 'ჩემთვის არაა')}</Button></span>} />
            : <ListRow key={project.projectId} to={projectPath(project.projectId)}
                lead={<Crest src={project.club?.crestUrl ?? null} name={project.club?.name ?? ''} size={32} />} title={project.goal}
                meta={project.steps.length ? project.steps.map(step => [step.step, step.day && dayWord(copy, step.day)].filter(Boolean).join(' · ')).join(', ') : project.club?.name}
                trail={project.steps.length ? <span className="pj-wait"><span className="pj-dot" data-tone="amber" aria-hidden="true" />{copy('Your step', 'თქვენი ნაბიჯი')}</span> : <ChevronRight aria-hidden="true" />} />)}
        </List></Panel>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Section></GkRoot>;
}
