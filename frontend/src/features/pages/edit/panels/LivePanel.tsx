import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../../../../design/primitives';
import { visualColors } from '../../../../styles/visualColors';
import { recordFunnelEvent } from '../../../feed/feedEvents';
import { Crest } from '../../../world/Crest';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

/** Right after going live: "Your page is live", the link to copy, a WhatsApp share and a QR code for the parents' group. */
export function LivePanel() {
  const t = usePagesCopy();
  const { page, closePanel } = usePageEdit();
  const [copied, setCopied] = useState(false);
  if (!page) return null;
  const url = `${window.location.origin}${page.links.profilePath}`;
  const text = t('{name} is on GrassKickZ: {url}', { name: page.identity.name, url });
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); recordFunnelEvent('PAGE_SHARED', { via: 'copy', pageRef: `${page.ref.type}-${page.ref.id}` }); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  return (
    <SplitPanel title={t('Your page is live')} description={t('It now shows in World, in search and in the feed. Share it with the parents’ group.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={<div className="gk-crest-preview"><QRCodeSVG value={url} size={148} bgColor={visualColors.paper} fgColor={visualColors.qrInk} /><span className="gk-muted">{t('For the training ground')}</span></div>}>
      <div className="gk-boxedit">
        <div className="gk-cmatch__page"><Crest src={page.identity.crest.url} name={page.identity.name} size={44} /><span className="gk-cmatch__text"><strong>{page.identity.name}</strong><small>{url.replace(/^https?:\/\//, '')}</small></span></div>
        <div className="gk-boxedit__foot">
          <Button variant="primary" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? t('Copied') : t('Copy link')}</Button>
          <a className="gk-btn gk-btn--secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => recordFunnelEvent('PAGE_SHARED', { via: 'whatsapp', pageRef: `${page.ref.type}-${page.ref.id}` })}><MessageCircle aria-hidden="true" />{t('Share in WhatsApp')}</a>
        </div>
      </div>
    </SplitPanel>
  );
}
