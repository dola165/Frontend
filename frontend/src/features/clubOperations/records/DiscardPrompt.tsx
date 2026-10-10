import { useEffect, useRef } from 'react';
import { Button, GkRoot } from '../../../design/primitives';
import './records.css';

/** Asks before unsaved work is discarded. Focus moves to the question and returns afterwards. */
export function DiscardPrompt({ disabled, onKeepEditing, onDiscard }: { disabled: boolean; onKeepEditing: () => void; onDiscard: () => void }) {
  const prompt = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement && !prompt.current?.contains(document.activeElement)) previousFocus.current = document.activeElement;
    prompt.current?.focus();
  }, []);
  return <GkRoot><div ref={prompt} tabIndex={-1} role="group" aria-label="Discard edits" className="gk-notice gk-notice--warning rec-prompt">
    <div className="rec-prompt__text"><strong>Discard your unsaved changes?</strong><p>Your saved version will stay as it is. Keep editing to continue this draft.</p></div>
    <Button size="sm" onClick={() => { onKeepEditing(); previousFocus.current?.focus(); }}>Keep editing</Button>
    <Button size="sm" variant="danger" disabled={disabled} onClick={() => { if (!disabled) onDiscard(); }}>Discard edits</Button>
  </div></GkRoot>;
}

