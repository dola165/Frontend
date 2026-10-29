import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { GkRoot, List, ListRow, Panel, Section } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { HelperEmailWait } from '../../components/auth/EmailWait';
import { confirmationJobTitle, needsConfirmedEmail } from '../../components/auth/emailConfirmation';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchHelping, type HelpingProject } from './api';
import { dayWord, projectPath } from './projectWords';
import './projects.css';

/**
 * Home for a parent or volunteer on a project (phase B2): each project they help with, its club, and the steps waiting
 * on them, each a tap away. Nothing else of the club; nothing at all for someone on no project (or when Home couldn't
 * ask: the project is also in their Inbox). A new helper whose email waits sees "Confirm your email to see …".
 */
export function HelpingProjectsCard() {
    const copy = useJourneyCopy();
    const [projects, setProjects] = useState<HelpingProject[]>([]);
    const [emailWait, setEmailWait] = useState<{ what: string | null } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void fetchHelping(controller.signal).then(rows => { if (!controller.signal.aborted) setProjects(rows); })
            .catch(failure => { if (!controller.signal.aborted && needsConfirmedEmail(failure)) setEmailWait({ what: confirmationJobTitle(failure) }); });
        return () => controller.abort();
    }, []);
    if (emailWait) return <GkRoot><HelperEmailWait what={emailWait.what} next="/home" /></GkRoot>;
    if (!projects.length) return null;
    return <GkRoot><Section boxed title={copy('Your projects', 'თქვენი პროექტები')} className="pj-helping">
        <Panel flush><List label={copy('Your projects', 'თქვენი პროექტები')}>{projects.map(project => <ListRow key={project.projectId} to={projectPath(project.projectId)}
            lead={<Crest src={project.club?.crestUrl ?? null} name={project.club?.name ?? ''} size={32} />} title={project.goal}
            meta={project.steps.length ? project.steps.map(step => [step.step, step.day && dayWord(copy, step.day)].filter(Boolean).join(' · ')).join(', ') : project.club?.name}
            trail={project.steps.length ? <span className="pj-wait"><span className="pj-dot" data-tone="amber" aria-hidden="true" />{copy('Your step', 'თქვენი ნაბიჯი')}</span> : <ChevronRight aria-hidden="true" />} />)}
        </List></Panel>
    </Section></GkRoot>;
}
