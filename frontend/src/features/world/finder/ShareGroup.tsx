import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, ButtonAnchor } from '../../../design/primitives';
import type { Opportunity } from '../../admissions/types';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { bornLabel, groupShareUrl } from './waysIn';

/**
 * Share a group with another parent: on WhatsApp, or as its link. The link opens the same pop-up on this group for a
 * signed-in parent, and the club's public group page for anyone else.
 */
export function ShareGroup({ group, clubName }: { group: Opportunity; clubName: string }) {
    const copy = useJourneyCopy();
    const [copied, setCopied] = useState(false);
    const url = groupShareUrl(group.id);
    const text = `${group.name} (${bornLabel(copy, group.birthYearFrom, group.birthYearTo) ?? ''}) · ${clubName} ${url}`;
    const copyLink = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    return <div className="gk-finder-share" data-guide="share-panel">
        <input className="gk-input" readOnly value={url} aria-label={copy('Link to this group', 'ამ ჯგუფის ბმული')} onFocus={event => event.currentTarget.select()} />
        <div className="gk-finder-acts">
            <ButtonAnchor size="sm" variant="primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">{copy('Send on WhatsApp', 'WhatsApp-ით გაგზავნა')}</ButtonAnchor>
            <Button size="sm" onClick={() => void copyLink()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy link', 'ბმულის კოპირება')}</Button>
        </div>
    </div>;
}
