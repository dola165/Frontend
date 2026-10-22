import type { LucideIcon } from 'lucide-react';
import { useBrandStyle } from './BrandStyleContext';
import { GMark } from './GMark';
import { BrandMark, type BrandVariant } from '../layout/BrandMark';

/** Change navigation artwork while keeping task-specific utility icons intact. */
export function BrandNavigationIcon({ icon: Icon, variant, size = 20, strokeWidth = 1.8, section = false }: { icon: LucideIcon; variant: BrandVariant; size?: number; strokeWidth?: number; section?: boolean }) {
    const { style } = useBrandStyle();
    return style === 'g' ? <GMark variant={variant} size={size} /> : section ? <BrandMark variant={variant} size={size} className="pitch-section-icon" /> : <Icon size={size} aria-hidden="true" strokeWidth={strokeWidth} />;
}
