import './profile-layout.css';
import type { ReactNode } from 'react';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { GkRoot, PageFrame } from '../primitives';
import { Tabs, type TabItem } from '../Tabs';

export interface ProfileIdentity {
    name: string;
    /** Crest or avatar. Without one, initials are shown. */
    image?: string | null;
    /** Clubs and organizations use a square crest; people a round avatar. */
    square?: boolean;
    /** Shown beside the name, for example a verified badge. */
    badge?: ReactNode;
    /** What this is: "Football academy", "Coach · Club staff". */
    line?: ReactNode;
    /** Short facts on one line: place, followers. Each item is separated. */
    facts?: ReactNode[];
}

interface ProfileLayoutProps<T extends string> {
    identity: ProfileIdentity;
    /** Optional cover. Kept short so the posts and tabs stay above the fold. */
    banner?: string | null;
    /** Controls over the cover, for example "Change cover". */
    bannerAction?: ReactNode;
    /** A control over the crest or avatar, for example "Change photo". */
    imageAction?: ReactNode;
    /** One primary action and a few secondary ones. */
    actions?: ReactNode;
    /** Shown under the header, for example a page-level error. */
    notice?: ReactNode;
    tabs: TabItem<T>[];
    tab: T;
    onTab: (tab: T) => void;
    /** Accessible name of the tab list, for example "Club sections". */
    tabsLabel: string;
    /** Side facts. Omit for a full-width tab such as a schedule. */
    side?: ReactNode;
    sideLabel?: string;
    children: ReactNode;
}

const initials = (name: string) => name.trim().split(/\s+/).filter(part => /^[\p{L}\p{N}]/u.test(part)).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';

/**
 * One layout for club, person and organization profiles: a compact identity header,
 * tabs kept in the URL by the page, and a main column with side facts that stacks on phones.
 */
export function ProfileLayout<T extends string>({ identity, banner, bannerAction, imageAction, actions, notice, tabs, tab, onTab, tabsLabel, side, sideLabel = 'About', children }: ProfileLayoutProps<T>) {
    const cover = resolveMediaUrl(banner);
    const image = resolveMediaUrl(identity.image);
    const facts = (identity.facts ?? []).filter(Boolean);
    return (
        <GkRoot className="gk-page gk-profile">
            <PageFrame width="profile">
                <header className={`gk-profile__head${cover ? ' gk-profile__head--cover' : ''}`}>
                    {cover && <div className="gk-profile__cover">
                        <MediaImage src={cover} alt="" className="gk-profile__cover-image" />
                        {bannerAction && <div className="gk-profile__cover-action">{bannerAction}</div>}
                    </div>}
                    <div className="gk-profile__identity">
                        <div className={`gk-profile__image${identity.square ? ' gk-profile__image--square' : ''}`}>
                            {image ? <MediaImage src={image} alt="" /> : <span aria-hidden="true">{initials(identity.name)}</span>}
                            {imageAction && <div className="gk-profile__image-action">{imageAction}</div>}
                        </div>
                        <div className="gk-profile__text">
                            <h1 className="gk-profile__name"><span>{identity.name}</span>{identity.badge}</h1>
                            {identity.line && <p className="gk-profile__line">{identity.line}</p>}
                            {facts.length > 0 && <ul className="gk-profile__facts" aria-label="Key facts">{facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
                        </div>
                        {(actions || (!cover && bannerAction)) && <div className="gk-profile__actions">{actions}{!cover && bannerAction}</div>}
                    </div>
                </header>
                {notice}
                <Tabs items={tabs} value={tab} onChange={onTab} label={tabsLabel} idBase="gk-profile-tab" className="gk-profile__tabs" />
                <div className={`gk-profile__body${side ? ' gk-profile__body--split' : ''}`}>
                    <div className="gk-profile__main" role="tabpanel" id={`gk-profile-tab-${tab}-panel`} aria-labelledby={`gk-profile-tab-${tab}`}>{children}</div>
                    {side && <aside className="gk-profile__side" aria-label={sideLabel}>{side}</aside>}
                </div>
            </PageFrame>
        </GkRoot>
    );
}

/** A small titled block of facts for the side column. */
export function SideBlock({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="gk-profile-side">
            <div className="gk-profile-side__head"><h2>{title}</h2>{action}</div>
            {children}
        </section>
    );
}

/** A label and value pair inside a side block. */
export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
    return <div className="gk-profile-fact"><dt>{label}</dt><dd>{children}</dd></div>;
}
