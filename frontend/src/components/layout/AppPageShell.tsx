import type { HTMLAttributes, ReactNode } from 'react';

interface AppPageShellProps {
    shellClassName?: string;
    hero?: ReactNode;
    beforeContent?: ReactNode;
    afterContent?: ReactNode;
    left?: ReactNode;
    center: ReactNode;
    right?: ReactNode;
    frameClassName?: string;
    gridClassName?: string;
    leftClassName?: string;
    centerClassName?: string;
    rightClassName?: string;
}

interface RegionProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode;
}

interface FrameProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    variant?: 'wide' | 'focused' | 'bleed';
}

const frameVariantClassName = {
    wide: 'app-page-frame--wide',
    focused: 'app-page-frame--focused',
    bleed: 'app-page-frame--bleed'
} as const;

export const AppPageFrame = ({ children, className = '', variant = 'wide', ...rest }: FrameProps) => (
    <div data-layout-frame={variant} className={`app-page-frame ${frameVariantClassName[variant]} ${className}`.trim()} {...rest}>
        {children}
    </div>
);

export const LeftRail = ({ children, className = '', ...rest }: RegionProps) => (
    <aside className={`app-left-rail min-w-0 rounded-[4px] ${className}`.trim()} {...rest}>
        {children}
    </aside>
);

export const CenterCanvas = ({ children, className = '', ...rest }: RegionProps) => (
    <section className={`app-center-canvas min-w-0 rounded-[4px] ${className}`.trim()} {...rest}>
        {children}
    </section>
);

export const RightRail = ({ children, className = '', ...rest }: RegionProps) => (
    <aside className={`app-right-rail min-w-0 rounded-[4px] ${className}`.trim()} {...rest}>
        {children}
    </aside>
);

export const AppPageShell = ({
    shellClassName = '',
    hero,
    beforeContent,
    afterContent,
    left,
    center,
    right,
    frameClassName = 'py-8',
    gridClassName = '',
    leftClassName = '',
    centerClassName = '',
    rightClassName = ''
}: AppPageShellProps) => {
    const regionClassName = left && right
        ? 'app-page-grid--both'
        : left
            ? 'app-page-grid--left'
            : right
                ? 'app-page-grid--right'
                : 'app-page-grid--center';

    return (
        <div className={`app-page-shell min-h-full ${shellClassName}`.trim()}>
            {hero}
            {beforeContent}

            <AppPageFrame className={`${frameClassName} app-page-column-band`.trim()}>
                <div className={`app-page-grid ${regionClassName} ${gridClassName}`.trim()}>
                    {left ? <LeftRail className={leftClassName}>{left}</LeftRail> : null}
                    <CenterCanvas className={centerClassName}>{center}</CenterCanvas>
                    {right ? <RightRail className={rightClassName}>{right}</RightRail> : null}
                </div>
            </AppPageFrame>

            {afterContent}
        </div>
    );
};
