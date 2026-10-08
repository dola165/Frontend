import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MediaImage } from '../../components/ui/MediaImage';
import { footballStock } from './footballMedia';
import type { Discipline } from './api';
import './competition-directory.css';
import './competition-detail.css';

/** Preserve host uploads; stock illustrates the sport, never the named event or venue. */
export function CompetitionVisual({ id, name, imageUrl, discipline }: { id: number; name: string; imageUrl?: string | null; discipline?: Discipline }) {
  const { i18n } = useTranslation();
  const [failed, setFailed] = useState<string[]>([]);
  const stock = footballStock(id, discipline);
  const uploaded = Boolean(imageUrl && !failed.includes(imageUrl));
  const source = uploaded ? imageUrl! : stock;
  const missing = failed.includes(source);
  const caption = i18n.language.startsWith('ka') ? 'ფეხბურთის საილუსტრაციო ფოტო' : 'Football stock photo';
  return <div className={`mc-event-media mc-event-photo${missing ? ' mc-event-identity' : ''}`}>
    {missing ? <div className="mc-identity-art" aria-hidden="true"><span className="mc-identity-emblem">{name.trim().split(/\s+/).slice(0, 3).map(word => word[0]).join('').toUpperCase()}</span><span className="mc-pitch-lines"/></div>
      : <MediaImage key={source} src={source} alt="" loading="lazy" className="mc-football-photo" onError={()=>setFailed(previous=>previous.includes(source)?previous:[...previous,source])}/>}
    {!uploaded && !missing && <span className="mc-stock-credit" title={caption}><Camera size={12} aria-hidden="true"/>{caption}</span>}
  </div>;
}
