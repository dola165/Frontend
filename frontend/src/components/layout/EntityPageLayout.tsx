import type { ReactNode } from 'react';

interface EntityFrameProps {
    children: ReactNode;
    className?: string;
}

interface EntityPageLayoutProps {
    left?: ReactNode;
    center: ReactNode;
    right?: ReactNode;
    beforeFrame?: ReactNode;
    afterFrame?: ReactNode;
    className?: string;
    frameClassName?: string;
    gridClassName?: string;
    leftClassName?: string;
    centerClassName?: string;
    rightClassName?: string;
}

interface EntitySectionProps {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
}

const entityFrameBaseClassName = 'app-page-frame app-page-frame--wide';

export const EntityFrame = ({ children, className = '' }: EntityFrameProps) => (
    <div className={`${entityFrameBaseClassName} ${className}`.trim()}>{children}</div>
);

export const EntityBannerBand = ({ children, className = '' }: EntityFrameProps) => (
    <section className={`border-b border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] ${className}`.trim()}>
        {children}
    </section>
);

export const EntityHeaderBand = ({ children, className = '' }: EntityFrameProps) => (
    <section className={`border-b border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] ${className}`.trim()}>
        <EntityFrame className="py-5">{children}</EntityFrame>
    </section>
);

const getGridClassName = (hasLeft: boolean, hasRight: boolean) => {
    if (hasLeft && hasRight) {
        return 'grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]';
    }

    if (hasLeft) {
        return 'grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]';
    }

    if (hasRight) {
        return 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]';
    }

    return 'grid gap-5';
};

export const EntityPageLayout = ({
    left,
    center,
    right,
    beforeFrame,
    afterFrame,
    className = '',
    frameClassName = 'py-6',
    gridClassName = '',
    leftClassName = '',
    centerClassName = '',
    rightClassName = ''
}: EntityPageLayoutProps) => {
    const hasLeft = Boolean(left);
    const hasRight = Boolean(right);
    const gridClassNameValue = `${getGridClassName(hasLeft, hasRight)} ${gridClassName}`.trim();

    return (
        <div className={`min-h-full bg-[color:var(--theme-page)] pb-10 text-[color:var(--text-primary)] ${className}`.trim()}>
            {beforeFrame}

            <EntityFrame className={frameClassName}>
                <div className={gridClassNameValue}>
                    {left && <aside className={`min-w-0 ${leftClassName}`.trim()}>{left}</aside>}
                    <div className={`min-w-0 ${centerClassName}`.trim()}>{center}</div>
                    {right && (
                        <aside className={`min-w-0 ${hasLeft ? 'lg:col-span-2 xl:col-span-1' : ''} ${rightClassName}`.trim()}>
                            {right}
                        </aside>
                    )}
                </div>
            </EntityFrame>

            {afterFrame}
        </div>
    );
};

export const EntitySection = ({
    eyebrow,
    title,
    description,
    actions,
    footer,
    children,
    className = '',
    headerClassName = '',
    bodyClassName = ''
}: EntitySectionProps) => {
    const hasHeader = Boolean(eyebrow || title || description || actions);

    return (
        <section className={`border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] ${className}`.trim()}>
            {hasHeader && (
                <div className={`border-b border-[color:var(--theme-border)] px-4 py-4 ${headerClassName}`.trim()}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            {eyebrow && <p className="text-[11px] font-semibold text-[color:var(--text-secondary)]">{eyebrow}</p>}
                            {title && <h2 className="mt-2 text-xl font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">{title}</h2>}
                            {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p>}
                        </div>
                        {actions && <div className="shrink-0">{actions}</div>}
                    </div>
                </div>
            )}

            <div className={bodyClassName}>{children}</div>

            {footer && <div className="border-t border-[color:var(--theme-border)]">{footer}</div>}
        </section>
    );
};
