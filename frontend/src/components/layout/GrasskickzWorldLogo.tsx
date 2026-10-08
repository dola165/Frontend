import './grasskickz-world-logo.css';

export function GrasskickzWorldLogo() {
    return <span className="world-logo" aria-hidden="true">
        <svg className="world-logo__mark" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.6" />
            <ellipse cx="20" cy="20" rx="7" ry="14" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 15h26M7 25h26" stroke="currentColor" strokeWidth="1.2" />
            <path className="world-logo__ball" d="m20 13 6.7 4.9-2.6 7.9h-8.2l-2.6-7.9Z" />
            <path d="m20 16 3.8 2.8-1.5 4.5h-4.6l-1.5-4.5Z" fill="currentColor" />
            <circle className="world-logo__satellite" cx="31.5" cy="8.5" r="3.4" />
        </svg>
        <span className="world-nav-wordmark world-logo__type">
            <span className="world-logo__name">Grass<span>Kick</span>Z</span>
            <span className="world-logo__world">WORLD</span>
        </span>
    </span>;
}
