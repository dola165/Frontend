import { Button, ButtonLink } from '../../design/primitives';
import { useNavigate } from 'react-router-dom';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { useProjectFacilitySource } from './useFacilityProject';
import './facilityProject.css';

/** Source facts have their own live authority check, independent of the project's Done state. */
export function ProjectFacilityOutcome({ club, project, version }: { club: number; project: number; version: number }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const source = useProjectFacilitySource(club, project, version);
    if (!source.loading && !source.failed && !source.data) return null;
    const task = source.data;
    const status = task?.status === 'COMPLETED' ? copy('Completed at source', 'პირველწყაროში დასრულებულია')
        : task?.status === 'CANCELLED' ? copy('Cancelled at source', 'პირველწყაროში გაუქმებულია') : copy('Outcome still to record', 'შედეგი ჯერ ჩასაწერია');
    return <section className="pj-facility" aria-label={copy('Facilities outcome', 'ობიექტის სამუშაოს შედეგი')}>
        {source.loading ? <p role="status">{copy('Checking facilities link…', 'ობიექტის სამუშაოს ბმული მოწმდება…')}</p>
            : source.failed ? <p role="alert">{copy('The current facilities link could not be checked.', 'ობიექტის სამუშაოს მიმდინარე ბმული ვერ შემოწმდა.')}</p>
            : task && <>
                <h2>{task.title}</h2><p>{status}</p>
                {task.outcome && <p>{task.outcome}</p>}
                <p className="gk-muted">{copy('Project Done records project work. This facilities record holds the actual operational outcome.', 'პროექტის დასრულება პროექტის სამუშაოს ასახავს. ფაქტობრივი შედეგი ობიექტის სამუშაოს ჩანაწერში ინახება.')}</p>
                <ButtonLink to={task.href} onClick={event => {
                    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    event.preventDefault(); guardWorkspaceNavigation(() => navigate(task.href));
                }}>{task.canRecordOutcome ? copy('Record actual outcome', 'ფაქტობრივი შედეგის ჩაწერა') : copy('Open facilities task', 'ობიექტის სამუშაოს გახსნა')}</ButtonLink>
            </>}
        <Button variant="ghost" onClick={source.reload}>{copy('Refresh facilities status', 'სამუშაოს სტატუსის განახლება')}</Button>
    </section>;
}
