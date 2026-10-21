import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { useAccountProfileDraft } from './useAccountProfileDraft';

export function AccountProfileFeedback({ draft }: { draft: ReturnType<typeof useAccountProfileDraft> }) {
    const copy = useJourneyCopy();
    if (!draft.receipt && !draft.notice && !draft.error) return null;
    const known: Record<string, string> = {
        'Could not confirm your profile save. Your draft is kept.': 'პროფილის შენახვა ვერ დადასტურდა. მონახაზი შენახულია.',
        'Could not upload this image. Your draft is kept.': 'სურათი ვერ აიტვირთა. მონახაზი შენახულია.',
        'Upload did not return a media URL.': 'ატვირთვამ სურათის ბმული ვერ დააბრუნა.',
    };
    return <div className="mb-4 text-sm">
        {draft.receipt && <div role={draft.receipt.refresh === 'failed' ? 'alert' : 'status'}>
            <p>{draft.receipt.refresh === 'pending'
                ? copy('Profile saved. Refreshing account details…', 'პროფილი შენახულია. ანგარიშის მონაცემები ახლდება…')
                : draft.receipt.refresh === 'failed'
                    ? copy('Profile saved. Account details couldn’t refresh.', 'პროფილი შენახულია. ანგარიშის მონაცემები ვერ განახლდა.')
                    : copy('Profile saved.', 'პროფილი შენახულია.')}</p>
            {draft.newerEdits && <p>{copy('Your newer changes are still here and have not been saved.', 'თქვენი ახალი ცვლილებები აქ არის და ჯერ არ შენახულა.')}</p>}
            {draft.receipt.refresh === 'failed' && <button type="button" className="app-text-action min-h-11" disabled={draft.refreshing || draft.saving || Boolean(draft.uploading)} aria-busy={draft.refreshing}
                onClick={() => void draft.retryRefresh()}>{copy('Refresh account details', 'ანგარიშის მონაცემების განახლება')}</button>}
        </div>}
        {draft.notice && <p role="status">{draft.notice === 'avatar'
            ? copy('Avatar updated in the draft form.', 'ავატარი მონახაზში განახლდა.')
            : copy('Banner updated in the draft form.', 'ბანერი მონახაზში განახლდა.')}</p>}
        {draft.error && <p role="alert">{copy(draft.error, known[draft.error] ?? draft.error)}</p>}
    </div>;
}
