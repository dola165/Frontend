import type { HTMLAttributes } from 'react';
import { BrandMark } from './BrandMark';
import './brand-identity.css';
interface GrasskickzLogoProps extends HTMLAttributes<HTMLDivElement> { compact?: boolean; wordmark?: boolean }
export const GrasskickzLogo = ({ compact = false, wordmark = false, className = '', ...props }: GrasskickzLogoProps) => <div className={`gk-brand ${compact ? 'gk-brand--compact' : ''} ${wordmark ? 'home-brand' : ''} ${className}`} {...props}>
    <BrandMark className="gk-brand-mark" /><span className="gk-brand-name">GrassKickz</span>
</div>;
