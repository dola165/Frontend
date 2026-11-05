import { AttachButton, WorkMediaList } from '../../components/work/WorkMedia';
import type { Uploads } from '../../components/work/useUploads';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { deletePlanMedia, planPlayLink, type PlanView, type WorkMedia } from './api';

/** What the team dropped on a plan: pictures to open, videos to watch, files to save, as under a task. */
export function PlanMedia({ planId, media, uploads, onChanged }: { planId: number; media: WorkMedia[]; uploads: Uploads; onChanged: (next: PlanView) => void }) {
    const copy = useJourneyCopy();
    return <section className="tw-section tw-files" aria-label={copy('Files, pictures and videos', 'ფაილები, სურათები და ვიდეოები')}>
        <AttachButton uploads={uploads} primary={media.length === 0} />
        {uploads.error && <p className="gk-notice gk-notice--danger" role="alert">{uploads.error}</p>}
        <WorkMediaList media={media} onChanged={onChanged} actions={{ remove: id => deletePlanMedia(planId, id), playLink: id => planPlayLink(planId, id) }} />
    </section>;
}
