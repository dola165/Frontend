import { useSearchParams } from 'react-router-dom';
import { Button, EmptyNote, GkRoot, PageFrame, Panel, Section } from '../../design/primitives';
import { ProfilePosts } from '../profiles/ProfilePosts';
import { useProfilePostFeed } from '../profiles/useProfilePostFeed';
import { defaultBoxes } from './boxes/defaultBoxes';
import { usePagesCopy } from './copy';
import { usePageEdit } from './edit/context';
import { PagePanels } from './edit/PagePanels';
import { PageDocument } from './PageDocument';

type Tab = 'posts' | 'about';

/** A fan club, a sponsor or business, or any other page: posts first, then what it is, on the shared page DNA. */
export function OrganizationPage() {
  const t = usePagesCopy();
  const { page, failed, retry } = usePageEdit();
  const [params, setParams] = useSearchParams();
  const feed = useProfilePostFeed(page ? `/posts/organization/${page.organizationId}` : '/posts/organization/0');
  if (!page) {
    return <GkRoot className="gk-page gk-profile"><PageFrame width="profile"><Panel>
      <EmptyNote title={failed ? t('This page couldn’t load') : t('Page not found')} action={failed ? <Button onClick={retry}>{t('Try again')}</Button> : undefined} />
    </Panel></PageFrame></GkRoot>;
  }
  const tab: Tab = params.get('tab') === 'about' ? 'about' : 'posts';
  const setTab = (next: Tab) => { const query = new URLSearchParams(params); if (next === 'posts') query.delete('tab'); else query.set('tab', next); setParams(query); };
  return (
    <>
      <PageDocument renderers={defaultBoxes} tabs={[{ id: 'posts', label: t('Posts') }, { id: 'about', label: t('About') }]} tab={tab} onTab={setTab} tabsLabel={t('Page sections')}>
        {tab === 'posts'
          ? <Section title={t('Posts')} hint={t('News and photos from {name}', { name: page.identity.name })}>
            <ProfilePosts feed={feed} empty={{ title: t('No posts yet'), body: page.viewer.canEdit ? t('Your first post is written for you when you go live.') : t('When the page shares news, it appears here.') }} />
          </Section>
          : <Section boxed title={t('About')}>
            <Panel padded><p className="gk-org-about">{page.identity.about.trim() || t('Nothing written yet.')}</p></Panel>
          </Section>}
      </PageDocument>
      <PagePanels />
    </>
  );
}
