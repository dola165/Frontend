import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { GkRoot, List, ListRow, Panel, Section } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchHelping, type HelpingProject } from './api';
import { dayWord, projectPath } from './projectWords';
import './projects.css';

/**
 * Home for a parent or volunteer on a project (phase B2): each project they help with, its club, and the steps waiting
 * on them, each a tap away. Nothing else of the club; nothing at all for someone on no project (or when Home couldn't
 * ask: the project is also in their Inbox).
 */
export function HelpingProjectsCard() {
    const copy = useJourneyCopy();
    const [projects, setProjects] = useState<HelpingProject[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        void fetchHelping(controller.signal).then(rows => { if (!controller.signal.aborted) setProjects(rows); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    if (!projects.length) return null;
    return <GkRoot><Section boxed title={copy('Your projects', 'თქვენი პროექტები')} className="pj-helping">
        <Panel flush><List label={copy('Your projects', 'თქვენი პროექტები')}>{projects.map(project => <ListRow key={project.projectId} to={projectPath(project.projectId)}
            lead={<Crest src={project.club?.crestUrl ?? null} name={project.club?.name ?? ''} size={32} />} title={project.goal}
            meta={project.steps.length ? project.steps.map(step => [step.step, step.day && dayWord(copy, step.day)].filter(Boolean).join(' · ')).join(', ') : project.club?.name}
            trail={project.steps.length ? <span className="pj-wait"><span className="pj-dot" data-tone="amber" aria-hidden="true" />{copy('Your step', 'თქვენი ნაბიჯი')}</span> : <ChevronRight aria-hidden="true" />} />)}
        </List></Panel>
    </Section></GkRoot>;
}
