import { ChevronRight, QrCode } from 'lucide-react';
import { Avatar, List, ListRow } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { JobChoice, StaffLink } from './api';
import { useJobWords } from './jobWords';

/** The club's working staff links, one row each: the job and where, who joined (faces) and what is left; opens the link. */
export function StaffLinkList({ links, choices, onOpen }: { links: StaffLink[]; choices: JobChoice[]; onOpen: (link: StaffLink) => void }) {
    const { copy, jobLabel, whereLabel } = useJobWords(choices);
    return <List className="pp-links" label={copy('Staff links', 'პერსონალის ბმულები')}>{links.map(link => {
        const left = Math.max(0, link.maxUses - link.uses), until = formatDate(link.expiresAt, { day: 'numeric', month: 'short' });
        return <ListRow key={link.id} onClick={() => onOpen(link)}
            lead={<span className="pp-links__icon" aria-hidden="true"><QrCode /></span>}
            title={`${jobLabel(link)} · ${whereLabel(link)}`}
            meta={copy(`${link.joined.length} joined · ${left} of ${link.maxUses} left · until ${until}`, `შემოვიდა ${link.joined.length} · დარჩა ${left} / ${link.maxUses} · ${until}-მდე`)}
            trail={<span className="pp-links__trail">
                <span className="pp-faces" aria-hidden="true">{link.joined.slice(0, 4).map(person => <Avatar key={person.appointmentId} src={resolveMediaUrl(person.avatarUrl) || null} name={person.name} size={28} />)}</span>
                <ChevronRight aria-hidden="true" className="gk-faint" />
            </span>} />;
    })}</List>;
}
