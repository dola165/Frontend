import { useId, useState } from 'react';
import { Button } from '../../../../design/primitives';
import { TOWNS } from '../../../start/towns';
import { usePagesCopy } from '../../copy';
import { BUSINESS_KINDS, CLUB_CATEGORIES, type BusinessKind, type ClubCategory } from '../../model/kinds';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const BUSINESS_WORDS: Record<BusinessKind, string> = { COMPANY: 'A business', SPONSOR: 'A sponsor', MEDIA: 'Media', HEALTHCARE: 'Healthcare' };
const CLUB_WORDS: Record<ClubCategory, string> = { COMMUNITY_CLUB: 'Community club', PRIVATE_ACADEMY: 'Academy', SCHOOL_CLUB: 'School club', AMATEUR_CLUB: 'Amateur club' };

/** The page's name, its town, and what kind of club or business it is. The About is typed under the name, where it shows. */
export function IdentityPanel() {
  const t = usePagesCopy();
  const { page, saveIdentity, closePanel } = usePageEdit();
  const [name, setName] = useState(page?.identity.name ?? '');
  const [town, setTown] = useState(page?.identity.town.name ?? '');
  const [businessKind, setBusinessKind] = useState<BusinessKind | null>(page?.identity.businessKind ?? null);
  const [clubCategory, setClubCategory] = useState<ClubCategory | null>((page?.identity.clubCategory as ClubCategory | null) ?? null);
  const id = useId();
  if (!page) return null;
  const save = async () => {
    const selectedTown = TOWNS.find(item => item.name === town);
    const ok = await saveIdentity({ name: name.trim(), town: { name: town, latitude: selectedTown?.latitude ?? page.identity.town.latitude, longitude: selectedTown?.longitude ?? page.identity.town.longitude }, ...(businessKind ? { businessKind } : {}), ...(clubCategory ? { clubCategory } : {}) }, { label: t('Saved') });
    if (ok) closePanel();
  };
  return (
    <SplitPanel title={t('Name and town')} onClose={closePanel} footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={name.trim().length < 2} onClick={() => void save()}>{t('Done')}</Button></>}>
      <div className="gk-boxedit">
        <div><label className="gk-field__label" htmlFor={`${id}-name`}>{t('Name')}</label><input id={`${id}-name`} className="gk-input" autoFocus value={name} maxLength={120} onChange={event => setName(event.target.value)} /></div>
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
