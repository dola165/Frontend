import './grasskickz-world-logo.css';
import { BrandMark } from './BrandMark';

export function GrasskickzWorldLogo() {
    return <span className="world-logo" aria-hidden="true">
        <BrandMark world className="world-logo__mark" />
        <span className="world-nav-wordmark world-logo__type">
            <span className="world-logo__name">GrassKickz</span>
            <span className="world-logo__world">WORLD</span>
        </span>
    </span>;
}
