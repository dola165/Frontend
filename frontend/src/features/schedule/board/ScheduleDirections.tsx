import { GkRoot } from '../../../design/primitives';
import './schedule-directions.css';
import { ExternalLink } from 'lucide-react';

import { directionsUrl } from './directionsUrl';

export function ScheduleDirections({ place, lat, lng }: { place?: string | null; lat?: number | null; lng?: number | null }) {
    const href = directionsUrl(place, lat, lng);
    return href ? <GkRoot className="schedule-directions"><a className="gk-btn gk-btn--ghost gk-btn--sm" href={href} target="_blank" rel="noopener noreferrer">Directions <ExternalLink size={16} aria-hidden="true" /></a></GkRoot> : null;
}
