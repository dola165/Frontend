import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CommerceDraftNotice } from '../../../components/workspace/CommerceDraftScope';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Button, Field, PageFrame, PageHeader } from '../../../design/primitives';
import { campaignDate, type Campaign } from '../../campaigns/api';
import { EditorDiscardPrompt } from './CommerceEditor';

/** Progress updates for a published campaign: earlier updates, and a new one to publish to supporters. */
export function CampaignUpdates({ campaign, saving, error, onCancel, onSubmit, backLabel = 'Back to campaigns' }: {
    campaign: Campaign; saving: boolean; error: string; onCancel: () => void; onSubmit: (title: string, body: string) => Promise<void>; backLabel?: string;
}) {
    const [title, setTitle] = useCommerceDraftState('form:updateTitle', '');
    const [body, setBody] = useCommerceDraftState('form:updateBody', '');
    const [discard, setDiscard] = useState(false);
    const close = () => { if (title || body) setDiscard(true); else onCancel(); };
    return <PageFrame className="cw-page cm-page">
        <div className="cm-editor__back"><Button variant="ghost" size="sm" disabled={saving} onClick={close}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
        <PageHeader title="Campaign updates" subtitle={campaign.title} />
        <div className="cm-updates">
            <form className="gk-panel cm-section" aria-label="New update" onSubmit={event => { event.preventDefault(); if (!saving) void onSubmit(title.trim(), body.trim()); }}>
                <header className="cm-section__head"><h2 className="gk-panel__title">New update</h2><p className="cm-hint">Supporters see updates on the campaign page.</p></header>
                <div className="cm-section__body">
                    <CommerceDraftNotice />
                    {error && <div className="gk-notice gk-notice--danger"><span className="cm-notice__text"><span role="alert">{error}</span><span>Your update draft is kept.</span></span></div>}
                    <fieldset disabled={saving} className="cm-editor__fields cm-fieldset">
                        <Field label="Update title" htmlFor="update-title"><input id="update-title" className="gk-input" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></Field>
                        <Field label="Update message" htmlFor="update-message" hint={`${body.length}/3000`}><textarea id="update-message" className="gk-input" required rows={5} maxLength={3000} value={body} onChange={event => setBody(event.target.value)} /></Field>
                    </fieldset>
                    <div className="cm-editor__actions">
                        <Button disabled={saving} onClick={close}>Close updates</Button>
                        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish update'}</Button>
                    </div>
                    {discard && <EditorDiscardPrompt label="Discard update" question="Discard this unsaved update?" detail="Nothing has been published." keepLabel="Keep writing" discardLabel="Discard update"
                        disabled={saving} onKeepEditing={() => setDiscard(false)} onDiscard={() => { if (!saving) onCancel(); }} />}
                </div>
            </form>
            <section className="gk-panel cm-section" aria-labelledby="campaign-earlier-updates">
                <header className="cm-section__head"><h2 id="campaign-earlier-updates" className="gk-panel__title">Earlier updates</h2></header>
                {campaign.updates.length ? <ul className="gk-list">{campaign.updates.map(update => <li key={update.id} className="cm-update">
                    <p className="cm-hint">{campaignDate(update.createdAt)}</p><h3>{update.title}</h3><p className="cm-row__message">{update.body}</p>
                </li>)}</ul> : <p className="cm-section__body cm-hint">No updates yet.</p>}
            </section>
        </div>
    </PageFrame>;
}
