import { CircleHelp } from 'lucide-react';

interface MapHelpHintProps {
    text: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
}

export const MapHelpHint = ({ text, align = 'left', className = '' }: MapHelpHintProps) => {
    const alignmentClass =
        align === 'right'
            ? 'map-help__tooltip--right'
            : align === 'center'
                ? 'map-help__tooltip--center'
                : '';

    return (
        <span className={`map-help ${className}`.trim()} tabIndex={0} aria-label={text}>
            <span className="map-help__trigger" aria-hidden="true">
                <CircleHelp className="h-3.5 w-3.5" />
            </span>
            <span className={`map-help__tooltip ${alignmentClass}`.trim()} role="tooltip">
                {text}
            </span>
        </span>
    );
};
