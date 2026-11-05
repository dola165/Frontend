import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { appLanguage } from '../../utils/formatting';
import { openFacilityProject } from './facilityProjectApi';
import { useFacilityProject } from './useFacilityProject';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import './facilityProject.css';

/** A small action on the actual permitted record; no copied source text in the project. */
export function FacilityProjectAction({ club, task }: { club: number; task: number }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const entry = useFacilityProject(club, task);
    const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
    const active = useRef(true), sending = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const open = async () => {
        if (sending.current) return;
        const session = getAuthSessionId();
        sending.current = true; setBusy(true); setUncertain(false);
        try {
            const project = await openFacilityProject(club, task, appLanguage() === 'ka' ? 'ka' : 'en');
            if (active.current && isCurrentAuthSession(session)) {
                entry.reload();
                guardWorkspaceNavigation(() => navigate(`/projects/${project.summary.id}`));
            }
        } catch {
            if (active.current && isCurrentAuthSession(session)) { setUncertain(true); entry.reload(); }
        } finally { sending.current = false; if (active.current && isCurrentAuthSession(session)) setBusy(false); }
    };
    return <Panel padded className="pj-facility-action" title={copy('Project', 'პროექტი')}><div className="gk-stack gk-stack--tight">
        <p className="gk-muted">{copy('Coordinate steps and people here. Record the actual outcome in this facilities task.', 'აქ დაგეგმეთ ნაბიჯები და ადამიანების საქმეები. ფაქტობრივი შედეგი ობიექტის ამ სამუშაოში ჩაწერეთ.')}</p>
        {entry.loading ? <p role="status">{copy('Checking project access…', 'პროექტზე წვდომა მოწმდება…')}</p>
            : entry.failed ? <><p role="alert">{copy('Project access could not be confirmed.', 'პროექტზე წვდომა ვერ დადასტურდა.')}</p><Button onClick={entry.reload}>{copy('Check again', 'ხელახლა შემოწმება')}</Button></>
            : entry.data?.projectId ? <ButtonLink to={`/projects/${entry.data.projectId}`} onClick={event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); guardWorkspaceNavigation(() => navigate(`/projects/${entry.data!.projectId}`));
            }}>{copy('Open project', 'პროექტის გახსნა')}</ButtonLink>
            : entry.data?.canStart ? <Button disabled={busy} onClick={() => void open()}>{busy ? copy('Opening…', 'იხსნება…') : copy('Start project', 'პროექტის დაწყება')}</Button>
            : <p className="gk-muted">{copy('No project is available with your current access.', 'თქვენი მიმდინარე წვდომით პროექტი მიუწვდომელია.')}</p>}
        {uncertain && <p role="alert">{copy('The project could not be confirmed. Check again, or retry Start project to find the same project.', 'პროექტი ვერ დადასტურდა. ხელახლა შეამოწმეთ ან გაიმეორეთ დაწყება იმავე პროექტის მოსაძებნად.')}</p>}
    </div></Panel>;
}
