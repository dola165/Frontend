import { useSearchParams } from 'react-router-dom';
import { Film, Image } from 'lucide-react';
import { Segmented } from '../../design/Tabs';
import { ProfileMedia, type ProfileMediaType } from './ProfileMedia';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/**
 * Photos and videos from a profile's posts, one kind at a time. The choice lives in the URL (`media`),
 * and older `?tab=videos` links open the videos.
 */
export function ProfileMediaTab({ endpoint, clubId }: { endpoint: string; clubId?: number }) {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const type: ProfileMediaType = params.get('media') === 'videos' || params.get('tab') === 'videos' ? 'videos' : 'pictures';
    const choose = (next: ProfileMediaType) => {
        const query = new URLSearchParams(params);
        query.set('tab', 'media');
        if (next === 'videos') query.set('media', 'videos'); else query.delete('media');
        setParams(query, { replace: true });
    };
    return <>
        <Segmented className="gk-profile-media-switch" label={copy('Show', 'ჩვენება')} value={type} onChange={choose}
            items={[{ id: 'pictures', label: copy('Photos', 'ფოტოები'), icon: <Image aria-hidden="true" /> }, { id: 'videos', label: copy('Videos', 'ვიდეოები'), icon: <Film aria-hidden="true" /> }]} />
        <ProfileMedia endpoint={endpoint} mediaType={type} clubId={clubId} />
    </>;
}
