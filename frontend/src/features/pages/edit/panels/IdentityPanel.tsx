import { useId, useState } from 'react';
import { Button } from '../../../../design/primitives';
import { TOWNS } from '../../../start/towns';
import { usePagesCopy } from '../../copy';
import { BUSINESS_KINDS, CLUB_CATEGORIES, type BusinessKind, type ClubCategory } from '../../model/kinds';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const BUSINESS_WORDS: Record<BusinessKind, string> = { COMPANY: 'A business', SPONSOR: 'A sponsor', MEDIA: 'Media', HEALTHCARE: 'Healthcare' };
const CLUB_WORDS: Record<ClubCategory, string> = { COMMUNITY_CLUB: 'Community club', PRIVATE_ACADEMY: 'Academy', SCHOOL_CLUB: 'School club', AMATEUR_CLUB: 'Amateur club' };

/** The few words about the page: its name, a line about it, its town, and what kind of club or business it is. */
export function IdentityPanel() {
  const t = usePagesCopy();
  const { page, saveIdentity, closePanel } = usePageEdit();
  const [name, setName] = useState(page?.identity.name ?? '');
  const [tagline, setTagline] = useState(page?.identity.tagline ?? '');
  const [about, setAbout] = useState(page?.identity.about ?? '');
  const [town, setTown] = useState(page?.identity.town.name ?? '');
  const [businessKind, setBusinessKind] = useState<BusinessKind | null>(page?.identity.businessKind ?? null);
  const [clubCategory, setClubCategory] = useState<ClubCategory | null>((page?.identity.clubCategory as ClubCategory | null) ?? null);
  const id = useId();
  if (!page) return null;
  const save = async () => {
    await saveIdentity({ name: name.trim(), tagline: tagline.trim(), about: about.trim(), aboutAuto: about.trim() === page.identity.about ? page.identity.aboutAuto : false, town: { name: town }, ...(businessKind ? { businessKind } : {}), ...(clubCategory ? { clubCategory } : {}) }, { label: t('Saved') });
    closePanel();
  };
  return (
    <SplitPanel title={t('About your page')} onClose={closePanel} footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={name.trim().length < 2} onClick={() => void save()}>{t('Done')}</Button></>}>
      <div className="gk-boxedit">
        <div><label className="gk-field__label" htmlFor={`${id}-name`}>{t('Name')}</label><input id={`${id}-name`} className="gk-input" autoFocus value={name} maxLength={120} onChange={event => setName(event.target.value)} /></div>
        <div><label className="gk-field__label" htmlFor={`${id}-tag`}>{t('One line under the name')}</label><input id={`${id}-tag`} className="gk-input" value={tagline} maxLength={80} placeholder={t('Football for everyone in Rustavi')} onChange={event => setTagline(event.target.value)} /></div>
        <div><label className="gk-field__label" htmlFor={`${id}-about`}>{t('About')}</label><textarea id={`${id}-about`} className="gk-input" rows={4} value={about} maxLength={600} placeholder={t('Say what you are, in a line or two')} onChange={event => setAbout(event.target.value)} /></div>
        <div>
          <p className="gk-field__label" id={`${id}-town`}>{t('Town')}</p>
          <div className="gk-ctowns" role="group" aria-labelledby={`${id}-town`}>{TOWNS.map(item => <button key={item.name} type="button" className="gk-chip" aria-pressed={item.name === town} onClick={() => setTown(item.name)}>{item.name}</button>)}</div>
        </div>
        {page.kind === 'BUSINESS' && <div>
          <p className="gk-field__label" id={`${id}-kind`}>{t('What kind of business?')}</p>
          <div className="gk-ctowns" role="group" aria-labelledby={`${id}-kind`}>{BUSINESS_KINDS.map(kind => <button key={kind} type="button" className="gk-chip" aria-pressed={businessKind === kind} onClick={() => setBusinessKind(kind)}>{t(BUSINESS_WORDS[kind])}</button>)}</div>
        </div>}
        {page.kind === 'CLUB' && <div>
          <p className="gk-field__label" id={`${id}-cat`}>{t('What kind of club?')}</p>
          <div className="gk-ctowns" role="group" aria-labelledby={`${id}-cat`}>{CLUB_CATEGORIES.map(category => <button key={category} type="button" className="gk-chip" aria-pressed={clubCategory === category} onClick={() => setClubCategory(category)}>{t(CLUB_WORDS[category])}</button>)}</div>
        </div>}
      </div>
    </SplitPanel>
  );
}
