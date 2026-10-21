import { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useJourneyCopy } from './journeyCopy';

/** Shares a destination only; existing match access and invitation rules still apply. */
export function MatchShare({ eventId, privateMatch }: { eventId: number; privateMatch: boolean }) {
  const { copy } = useJourneyCopy();
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const url = `${window.location.origin}/match-exchange/${eventId}`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
    }
  }
  return <div className="mx-stack">
    <button className="mx-button" type="button" onClick={() => void copyLink()}>
      <LinkIcon size={16} aria-hidden="true" />{copy('copyMatchLink')}
    </button>
    {state === 'copied' && <p role="status" className="mx-muted">{copy('matchLinkCopied')}</p>}
    {state === 'manual' && <label>{copy('copyMatchLinkManually')}
      <input readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </label>}
    {state !== 'idle' && <p className="mx-muted">{copy(privateMatch ? 'privateMatchLink' : 'matchLinkInvitation')}</p>}
  </div>;
}
