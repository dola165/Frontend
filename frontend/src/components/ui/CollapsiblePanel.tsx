import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';

interface CollapsiblePanelProps {
    title: string;
    eyebrow?: string;
    summary?: ReactNode;
    helpText?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
    bodyClassName?: string;
}

export const CollapsiblePanel = ({
    title,
    eyebrow,
    summary,
    helpText,
    actions,
    children,
    defaultOpen = false,
    className = '',
    bodyClassName = ''
}: CollapsiblePanelProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const panelId = useId();

    return (
        <section className={`app-card overflow-hidden rounded-[4px] ${className}`.trim()}>
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
            >
                <span className="min-w-0">
                    {eyebrow ? <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a1a1aa]">{eyebrow}</span> : null}
                    <span className="mt-1 block truncate text-[11px] font-semibold  text-[#f4f4f5]">{title}</span>
                    {summary ? <span className="mt-2 block text-sm leading-6 text-[#a1a1aa]">{summary}</span> : null}
                </span>

                <span className="flex shrink-0 items-center gap-3">
                    {actions}
                    {helpText ? (
                        <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#ffffff0d] text-[#a1a1aa]"
                            title={typeof helpText === 'string' ? helpText : undefined}
                            aria-label={typeof helpText === 'string' ? helpText : 'Help'}
                        >
                            <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                    ) : null}
                    <ChevronDown className={`h-4 w-4 text-[#a1a1aa] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen ? (
                <div id={panelId} className={`border-t border-[#ffffff0d] px-4 py-4 ${bodyClassName}`.trim()}>
                    {children}
                </div>
            ) : null}
        </section>
    );
};
