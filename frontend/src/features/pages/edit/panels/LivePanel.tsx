import { useId, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { apiClient } from '../../../../api/axiosConfig';
import { Button } from '../../../../design/primitives';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { visualColors } from '../../../../styles/visualColors';
import { recordFunnelEvent } from '../../../feed/feedEvents';
import { Crest } from '../../../world/Crest';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

/** Right after going live: "Your page is live", the link to copy, a WhatsApp share and a QR code for the parents' group. */
export function LivePanel() {
  const t = usePagesCopy();
  const { page, closePanel, openPanel } = usePageEdit();
  const [copied, setCopied] = useState(false);
  const [post, setPost] = useState(() => t('{name} joined GrassKickZ', { name: page?.identity.name ?? '' }));
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const id = useId();
  if (!page) return null;
  const url = `${window.location.origin}${page.links.profilePath}`;
  const publish = async () => {
    setPosting(true);
    try {
      await apiClient.post('/posts', { content: post.trim(), clubId: page.clubId, organizationId: page.clubId ? null : page.organizationId, isPublic: true, mediaIds: [] });
      setPosted(true);
      toast.success(t('Posted'));
    } catch (error) { toast.error(extractApiErrorMessage(error, t('Could not post. Try again.'))); }
    finally { setPosting(false); }
  };
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
        {page.kind === 'CLUB' && <div className="gk-boxedit__foot"><Button size="sm" onClick={() => openPanel('players')}>{t('Invite players')}</Button><Button size="sm" onClick={() => openPanel('staff')}>{t('Invite coaches & staff')}</Button></div>}
        {/* The first post, written for the owner: editable, one tap to post, or skipped. */}
        <div>
          <label className="gk-field__label" htmlFor={`${id}-post`}>{t('Your first post')}</label>
          {posted ? <p className="gk-row"><Check aria-hidden="true" size={14} />{t('Posted')}</p> : <>
            <textarea id={`${id}-post`} className="gk-input" rows={2} value={post} maxLength={400} onChange={event => setPost(event.target.value)} />
            <div className="gk-boxedit__foot" style={{ marginTop: 8 }}><Button size="sm" variant="primary" disabled={posting || !post.trim()} onClick={() => void publish()}>{t('Post it')}</Button><span className="gk-faint">{t('or skip it')}</span></div>
          </>}
        </div>
      </div>
    </SplitPanel>
  );
}
