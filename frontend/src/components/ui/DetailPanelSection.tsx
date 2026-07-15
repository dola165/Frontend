import type { ReactNode } from 'react';

interface DetailPanelSectionProps {
    title: string;
    eyebrow?: string;
    description?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}

export const DetailPanelSection = ({
    title,
    eyebrow,
    description,
    actions,
    children,
    className = ''
}: DetailPanelSectionProps) => (
    <section className={`app-card overflow-hidden rounded-[4px] ${className}`.trim()}>
        <div className="border-b border-[#ffffff0d] px-4 py-2.5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a1a1aa]">{eyebrow}</p> : null}
                    <h2 className="mt-1 text-[11px] font-semibold  text-[#f4f4f5]">{title}</h2>
                    {description ? <div className="mt-1.5 text-sm leading-5 text-[#a1a1aa]">{description}</div> : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </div>
        {children ? <div className="px-4 py-3">{children}</div> : null}
    </section>
);
