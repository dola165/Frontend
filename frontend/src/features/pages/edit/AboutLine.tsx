import { usePagesCopy } from '../copy';
import { InlineText } from './InlineText';
import { usePageEdit } from './context';

/**
 * The page's About, one sentence, edited where it shows under the name. It starts written for the owner (from the
 * type, the town and the teams) and keeps following them until the owner writes their own.
 */
export function AboutLine() {
  const t = usePagesCopy();
  const { page, saveIdentity } = usePageEdit();
  if (!page) return null;
  return <InlineText as="p" step="about" value={page.identity.about} placeholder={t('Say what you are, in one sentence')} label={t('About')} maxLength={160} className="gk-profile__summary"
    onSave={next => void saveIdentity({ about: next, aboutAuto: false }, { label: t('About saved') })} />;
}
