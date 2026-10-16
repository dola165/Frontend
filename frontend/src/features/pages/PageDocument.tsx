import { type ReactNode } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { Badge, Button } from '../../design/primitives';
import { ProfileLayout } from '../../design/profile/ProfileLayout';
import type { TabItem } from '../../design/Tabs';
import { usePagesCopy } from './copy';
import { EditBar } from './edit/EditBar';
import { AboutLine } from './edit/AboutLine';
import { InlineText } from './edit/InlineText';
import { PageColumn } from './edit/PageColumn';
import { usePageEdit } from './edit/context';
import { RearrangeFrame } from './edit/Rearrange';
import type { BoxRenderers } from './edit/boxRegistry';
import { BUSINESS_KINDS, type PageKind } from './model/kinds';
import './edit/edit.css';

const KIND_WORD: Record<PageKind, string> = { CLUB: 'Club', FAN_CLUB: 'Fan club', BUSINESS: 'Business', PAGE: 'Page', VENUE: 'Venue' };
const BUSINESS_WORD: Record<typeof BUSINESS_KINDS[number], string> = { COMPANY: 'Business', SPONSOR: 'Sponsor', MEDIA: 'Media', HEALTHCARE: 'Healthcare' };

/**
 * A page on the shared DNA: the identity header (name, crest, cover, town, about), the edit bar under it, the
 * owner's boxes in two side columns and the page's own main content (posts) between them. In edit mode the name and
 * the about are edited where they are, the crest and cover open their panels, and empty boxes show as ghosts.
 */
export function PageDocument<T extends string>({ renderers, tabs, tab, onTab, tabsLabel, actions, children }: {
  renderers: BoxRenderers; tabs: TabItem<T>[]; tab: T; onTab: (tab: T) => void; tabsLabel: string; actions?: ReactNode; children: ReactNode;
}) {
  const t = usePagesCopy();
  const { page, editing, saveIdentity, openPanel } = usePageEdit();
  if (!page) return null;
  const { identity } = page;
  const kind = page.kind === 'BUSINESS' && identity.businessKind ? BUSINESS_WORD[identity.businessKind] : KIND_WORD[page.kind];
  const about = identity.about.trim();
  return (
    <RearrangeFrame><ProfileLayout className="gk-page-doc"
      identity={{
        name: identity.name, image: identity.crest.url, square: true,
        nameNode: editing ? <InlineText as="span" value={identity.name} placeholder={t('Name your page')} label={t('Name')} maxLength={120} onSave={next => { if (next.length >= 2) void saveIdentity({ name: next }, { label: t('Name saved') }); }} /> : undefined,
        badge: page.status === 'DRAFT' ? <Badge tone="warning">{t('Draft')}</Badge> : page.verification === 'VERIFIED' ? <Badge tone="accent">{t('Verified')}</Badge> : undefined,
        line: <>{t(kind)}{page.viewer.role === 'OWNER' && <> · {t('Your role: Owner')}</>}</>,
        facts: [<><MapPin aria-hidden="true" />{identity.town.name}</>],
        summary: about || undefined,
        summaryNode: editing ? <AboutLine /> : undefined,
      }}
      banner={identity.cover?.url ?? null}
      bannerAction={editing ? <Button size="sm" onClick={() => openPanel('cover')}><Camera aria-hidden="true" />{identity.cover ? t('Change cover') : t('Add cover')}</Button> : undefined}
      imageAction={editing ? <Button size="sm" iconOnly aria-label={t('Change crest')} className={page.goLive.missing.includes('crest') ? 'gk-needs' : undefined} onClick={() => openPanel('crest')}><Camera aria-hidden="true" /></Button> : undefined}
      actions={actions}
      notice={<EditBar />}
      tabs={tabs} tab={tab} onTab={onTab} tabsLabel={tabsLabel}
      sideLeft={<PageColumn column="left" renderers={renderers} />} sideLeftLabel={t('Information')}
      side={<PageColumn column="right" renderers={renderers} />} sideLabel={t('More')}>
      {children}
    </ProfileLayout></RearrangeFrame>
  );
}
