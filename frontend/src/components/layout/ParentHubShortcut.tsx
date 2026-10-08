import {Link} from 'react-router-dom';
import {HeartHandshake} from 'lucide-react';
import type {CSSProperties} from 'react';

export function ParentHubShortcut() {
    return (<Link to="/parent" className="feed-side-link home-social-link" style={{ '--shortcut-accent': 'var(--social-primary)' } as CSSProperties}>
                        <span className="flex min-w-0 items-center gap-3">
                            <span className="home-shortcut-icon"><HeartHandshake className="h-5 w-5" /></span>
                            <span className="min-w-0">
                                <span className="feed-side-link__title text-sm font-semibold text-[var(--feed-text-primary)]">Parent Hub</span>
                                <span className="block truncate text-[10px] text-[var(--feed-text-muted)]">Your children, squads and coach updates</span>
                            </span>
                        </span>
                    </Link>);
}
