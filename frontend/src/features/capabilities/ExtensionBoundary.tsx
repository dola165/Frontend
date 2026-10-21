import { ArrowRight, Compass } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    resolveExtensionCapability,
    type ExtensionCapabilityKey,
} from './extensions';
import './extensions.css';

interface BoundaryProps {
    capability: ExtensionCapabilityKey;
    children: ReactNode;
}

export function ExtensionRoute({ capability, children }: BoundaryProps) {
    const resolved = resolveExtensionCapability(capability);

    if (!resolved.available) {
        return <main className="extension-unavailable" data-capability={capability}>
            <span className="extension-unavailable-icon" aria-hidden="true"><Compass size={28} strokeWidth={1.65}/></span><span className="extension-unavailable-label">Coming later</span>
            <h1>{resolved.title} is not available yet</h1>
            <p>{resolved.unavailableDescription}</p>
            <Link to={resolved.fallbackPath}>{resolved.fallbackLabel}<ArrowRight size={17} aria-hidden="true"/></Link>
        </main>;
    }

    return <>{children}</>;
}

export function ExtensionSurface({ capability, children }: BoundaryProps) {
    const resolved = resolveExtensionCapability(capability);
    return resolved.available ? <>{children}</> : null;
}

