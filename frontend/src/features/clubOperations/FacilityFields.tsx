import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ImageUploadField } from '../../components/workspace/editor/ImageUploadField';
import { LocationPicker } from '../../components/workspace/editor/LocationPicker';
import { Button, Field, SearchInput } from '../../design/primitives';
import type { Bootstrap, Definition, Field as FieldDefinition } from './api';
import './records/records.css';

function Part({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return <section className="rec-subgroup"><div className="rec-form__group-head"><h4>{title}</h4><p>{description}</p></div>{children}</section>;
}

/**
 * The extra fields of a venue or facility record: the place itself with an optional venue link and map
 * pin (`place`), or the visitor information shown on the public page (`visitors`).
 */
export function FacilityFields({ mode, boot, definition, data, change, renderField, onUploading }: {
    mode: 'place' | 'visitors'; boot: Bootstrap; definition: Definition; data: Record<string, string>;
    change: (values: Record<string, string>) => void; renderField: (field: FieldDefinition) => ReactNode; onUploading: (value: boolean) => void;
}) {
    const [query, setQuery] = useState(''), [mapOpen, setMapOpen] = useState(false);
    const fields = (keys: string[]) => definition.fields.filter(field => keys.includes(field.key)).map(renderField);
    const venue = boot.venues.find(item => String(item.id) === data.venueId);
    const venues = boot.venues.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    if (mode === 'visitors') return <div className="rec-subgroups">
        <Part title="Photos" description="The venue or facility and its entrance.">
            <ImageUploadField label="Location photos" images={(data.photos ?? '').split(/\r?\n/).filter(Boolean)} onChange={images => change({ photos: images.join('\n') })} onBusyChange={onUploading} />
        </Part>
        <Part title="Getting there" description="Optional public information for anyone visiting this place."><div className="rec-fields">{fields(['arrival', 'transport', 'accessibility'])}</div></Part>
        <Part title="At this location" description="Facilities, what to bring and who to contact."><div className="rec-fields">{fields(['amenities', 'whatToBring', 'contact'])}</div></Part>
        <Part title="Parents and collection" description="Only when it applies to the groups using this location."><div className="rec-fields">{fields(['collection'])}</div></Part>
    </div>;
    return <div className="rec-subgroups">
        <div className="rec-fields">{fields(['placeType', 'address', 'relationship', 'description'])}</div>
        <details className="rec-disclosure" open={data.venueId ? true : undefined}>
            <summary>Link a published venue (optional)</summary>
            <div className="rec-disclosure__body">
                <p className="rec-hint">For a playing ground, link its venue page. For a supporting facility, link the venue it belongs to. Linking does not claim ownership, reserve a pitch or make this place available to rent.</p>
                {data.venueId ? <div className="rec-linked">
                    <span className="rec-linked__text"><strong>{venue?.name ?? 'Previously linked venue'}</strong><Link className="rec-link" to={`/stadiums/${data.venueId}`} target="_blank" rel="noreferrer">View venue page</Link></span>
                    <Button size="sm" onClick={() => change({ venueId: '' })}>Unlink</Button>
                </div> : <>
                    <Field label="Find an existing venue" htmlFor="facility-venue-search"><SearchInput id="facility-venue-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search venue name" /></Field>
                    {venues.length > 0 && <ul className="rec-choices">{venues.slice(0, 20).map(item => <li key={item.id}><button type="button" className="gk-list-row" onClick={() => change({ venueId: String(item.id) })}>{item.name}</button></li>)}</ul>}
                    <p className="rec-hint">{!venues.length ? 'No matching venue. You can still save this place without a link.' : venues.length > 20 ? 'Keep typing to narrow the list.' : 'Choose a venue, or leave this empty.'}</p>
                </>}
            </div>
        </details>
        <details className="rec-disclosure" onToggle={event => setMapOpen(event.currentTarget.open)}>
            <summary>Set the visitor entrance on the map (optional)</summary>
            <div className="rec-disclosure__body">{mapOpen && <LocationPicker latitude={data.latitude ?? ''} longitude={data.longitude ?? ''} onChange={(latitude, longitude) => change({ latitude, longitude })} />}</div>
        </details>
    </div>;
}
