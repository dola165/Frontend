import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface Choice<T extends string | number> { value: T; label: ReactNode; hint?: string }

/** A single choice shown as chips (a radio group): arrow keys move, the chosen chip is the tab stop. */
export function ChoiceChips<T extends string | number>({ label, labelledBy, choices, value, onChange, invalid }: {
    label?: string; labelledBy?: string; choices: Choice<T>[]; value: T | null; onChange: (value: T) => void; invalid?: boolean;
}) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const current = choices.findIndex(choice => choice.value === value);
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!delta || !choices.length) return;
        event.preventDefault();
        const next = (Math.max(current, 0) + delta + choices.length) % choices.length;
        onChange(choices[next].value);
        refs.current[next]?.focus();
    };
    return (
        <div role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} aria-invalid={invalid || undefined} className="gk-chips gk-arrange__chips" onKeyDown={onKey}>
            {choices.map((choice, index) => (
                <button key={String(choice.value)} ref={node => { refs.current[index] = node; }} type="button" role="radio" className="gk-chip"
                    aria-checked={choice.value === value} tabIndex={index === (current < 0 ? 0 : current) ? 0 : -1} title={choice.hint}
                    onClick={() => onChange(choice.value)}>
                    {choice.label}
                </button>
            ))}
        </div>
    );
}
