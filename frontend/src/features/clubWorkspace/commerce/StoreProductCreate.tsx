import { useState } from 'react';
import { useClearCommerceForm } from '../../../components/workspace/commerceDraftState';
import { Button, ButtonLink } from '../../../design/primitives';
import { type StoreProduct, type StoreProductPayload, formatStorePrice } from '../../store/api';
import { ct, useCommerceCopy } from '../../store/copy';
import { useStoreCreateRecovery } from '../../store/createRecovery';
import { EditorDiscardPrompt } from './CommerceEditor';
import { StoreProductForm } from './StoreProductForm';

function HeldAnswers({ input }: { input?: StoreProductPayload }) {
    if (!input) return null;
    return <details className="gk-notice"><summary>{ct('Held unsaved answers')}</summary>
        <p>{input.name}</p><p>{input.description}</p><p>{formatStorePrice(input.price ?? 0, input.currency)} · {input.active ? ct('Published when saved') : ct('Draft')}</p>
        <ul>{input.variants?.map((v, i) => <li key={i}>{v.label} · {v.stock}</li>)}</ul>
        {input.images?.map((image, i) => <p key={i}>{image}</p>)}
    </details>;
}

/** The recovery notice stays available while the manager reviews the known-ID list/editor. */
export function StoreCreateReviewNotice({ clubId }: { clubId: number }) {
    useCommerceCopy();
    const recovery = useStoreCreateRecovery(clubId);
    const [confirm, setConfirm] = useState(false);
    const saved = recovery.attempt?.product;
    if (!saved || recovery.attempt?.state !== 'review') return null;
    return <div className="gk-notice" role="status"><p>{ct('The original product is saved. Held answers have not been applied. Review the saved product before editing it.')}</p>
        <p>{saved.name} · #{saved.id} · {formatStorePrice(saved.price ?? 0, saved.currency)} · {saved.active ? ct('Published') : ct('Draft')}</p>
        <HeldAnswers input={recovery.attempt.held} />
        <Button variant="ghost" onClick={() => setConfirm(true)}>{ct('Finish reviewing this create')}</Button>
        {confirm && <EditorDiscardPrompt disabled={false} question={ct('Finish reviewing this recovered create?')} detail={ct('This clears only the held answers. The saved product is unchanged.')} discardLabel={ct('Finish review')}
            onKeepEditing={() => setConfirm(false)} onDiscard={() => { recovery.finishReview(); setConfirm(false); }} />}
    </div>;
}

/** Shared by workspace and public Add product; only an unchanged, current acknowledgement completes. */
export function StoreProductCreate({ clubId, defaultActive = false, draftHint, onDone, onCancel, onReview }: {
    clubId: number; defaultActive?: boolean; draftHint?: string; onDone: (product: StoreProduct) => void; onCancel: () => void; onReview?: () => void;
}) {
    useCommerceCopy();
    const recovery = useStoreCreateRecovery(clubId);
    const clearForm = useClearCommerceForm();
    const [revision, setRevision] = useState(0), [discard, setDiscard] = useState(false);
    const attempt = recovery.attempt;
    const canSeparate = !recovery.pending && (attempt?.state === 'review' || attempt?.state === 'uncertain' && attempt.refused && !attempt.unknown);
    const prepareReview = () => { recovery.hold(); clearForm(); };
    const notice = attempt && <div className="gk-notice" role="status">
        <p>{attempt.state === 'orphan' ? ct('An earlier product save needs review. The original request is no longer in memory, so this editor cannot safely create another product.')
            : attempt.state === 'conflict' ? ct('The original save needs review. This editor will not use a new key or create another product.')
            : attempt.state === 'review' ? ct('The original product is saved. The answers below are still unsaved and have not been applied.')
            : ct('Save checks the original request first. Changed answers stay here until that save is confirmed.')}</p>
        {attempt.product && <p>{attempt.product.name} · #{attempt.product.id} · {formatStorePrice(attempt.product.price ?? 0, attempt.product.currency)} · {attempt.product.active ? ct('Published') : ct('Draft')}</p>}
        {recovery.blocked && (onReview ? <Button variant="ghost" onClick={() => { prepareReview(); onReview(); }}>{ct('Review saved products')}</Button>
            : <ButtonLink variant="ghost" to={`/clubs/${clubId}/workspace?tab=store`} onClick={prepareReview}>{ct('Review saved products')}</ButtonLink>)}
        {canSeparate && <Button variant="ghost" disabled={recovery.pending} onClick={() => setDiscard(true)}>{ct('Start a separate product')}</Button>}
    </div>;
    return <>
        <StoreProductForm key={revision} product={null} defaultActive={defaultActive} draftHint={draftHint} initialInput={attempt?.held}
            saving={recovery.pending} saveDisabled={recovery.blocked} formError={recovery.error} recoveryNotice={notice} onDraftChange={recovery.observe}
            cancelCopy={attempt ? { question: ct('Close this editor and keep recovery?'), detail: ct('The original save and held answers stay available in this login and club.'), discardLabel: ct('Close and keep answers') } : undefined}
            onCancel={() => { recovery.hold(); clearForm(); onCancel(); }}
            onSubmit={input => { setDiscard(false); return recovery.save(input, product => { clearForm(); onDone(product); }); }} />
        {discard && canSeparate && <EditorDiscardPrompt disabled={recovery.pending} question={ct('Start a separate product?')} detail={attempt?.product ? ct('The saved product stays unchanged. The held answers in this editor will be cleared.') : ct('The earlier request was rejected before creation. This clears the held answers and starts a separate draft.')} discardLabel={ct('Start new draft')} onKeepEditing={() => setDiscard(false)} onDiscard={() => {
            if (recovery.finishReview()) { clearForm(); setRevision(value => value + 1); } setDiscard(false);
        }} />}
    </>;
}
