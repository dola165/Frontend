import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { apiClient } from '../../../../api/axiosConfig';
import { Button } from '../../../../design/primitives';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { visualColors } from '../../../../styles/visualColors';
import { Crest } from '../../../world/Crest';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';
import { useOrganizationPostPublication } from '../../../../components/feed/postPublication';
import { getAuthSessionId, isCurrentAuthSession } from '../../../../utils/authStorage';
import { useJourneyCopy } from '../../../squadCommunication/journeyCopy';

/** Right after going live: "Your page is live", the link to copy, a WhatsApp share and a QR code for the parents' group. */
export function LivePanel() {
  const t = usePagesCopy();
  const postCopy = useJourneyCopy();
  const { page, closePanel, openPanel } = usePageEdit();
  const [copied, setCopied] = useState(false);
  const [post, setPost] = useState(() => t('{name} joined GrassKickZ', { name: page?.identity.name ?? '' }));
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const publication = useOrganizationPostPublication(page?.clubId ? undefined : page?.organizationId);
  const mounted = useRef(false), pending = useRef(false);
  useEffect(() => { mounted.current = true;return () => { mounted.current = false; }; }, []);
  const id = useId();
  if (!page) return null;
  const canPublish = !!page.clubId || page.status === 'LIVE' && !!page.organizationId && page.viewer.canEdit && ['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(page.viewer.role ?? '');
  const url = `${window.location.origin}${page.links.profilePath}`;
  const publish = async () => {
    if (pending.current) return;
    const session = getAuthSessionId();
    const current = () => mounted.current && isCurrentAuthSession(session);
    pending.current = true;
    setPosting(true);
    try {
      if (page.clubId) await apiClient.post('/posts', { content: post.trim(), clubId: page.clubId, organizationId: null, isPublic: true, mediaIds: [] });
      else {
        if (page.status !== 'LIVE' || !page.organizationId || !page.viewer.canEdit || !['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(page.viewer.role ?? '')) throw new Error('Publish this page before posting.');
        await publication.publish({ content: post.trim(), clubId: null, organizationId: page.organizationId, isPublic: true, mediaIds: [] }, { _authSessionId: session });
      }
      if (!current()) return;
      if (!page.clubId) publication.complete();
      setPosted(true);
      toast.success(t('Posted'));
    } catch (error) { if (current()) toast.error(extractApiErrorMessage(error, t('Could not post. Try again.'))); }
    finally { pending.current = false;if (current()) setPosting(false); }
  };
  const text = t('{name} is on GrassKickZ: {url}', { name: page.identity.name, url });
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  return (
    <SplitPanel title={t('Your page is live')} description={t(page.kind === 'CLUB' ? 'It now shows in World, in search and in the feed. Share it with the parents’ group.' : 'It now shows in World, in search and in the feed. Share it where your people are.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={<div className="gk-crest-preview"><QRCodeSVG value={url} size={148} bgColor={visualColors.paper} fgColor={visualColors.qrInk} /><span className="gk-muted">{t(page.kind === 'CLUB' ? 'For the training ground' : 'To print or show')}</span></div>}>
      <div className="gk-boxedit">
        <div className="gk-cmatch__page"><Crest src={page.identity.crest.url} name={page.identity.name} size={44} /><span className="gk-cmatch__text"><strong>{page.identity.name}</strong><small>{url.replace(/^https?:\/\//, '')}</small></span></div>
        <div className="gk-boxedit__foot">
          <Button variant="primary" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? t('Copied') : t('Copy link')}</Button>
          <a className="gk-btn gk-btn--secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />{t('Share in WhatsApp')}</a>
        </div>
        {page.kind === 'CLUB' && <div className="gk-boxedit__foot"><Button size="sm" onClick={() => openPanel('players')}>{t('Invite players')}</Button><Button size="sm" onClick={() => openPanel('staff')}>{t('Invite coaches & staff')}</Button></div>}
        {/* The first post, written for the owner: editable, one tap to post, or skipped. */}
        <div>
          <label className="gk-field__label" htmlFor={`${id}-post`}>{t('Your first post')}</label>
          {posted ? <p className="gk-row"><Check aria-hidden="true" size={14} />{t('Posted')}</p> : !canPublish ? <p>{postCopy('Publish this page before posting.', 'პოსტის გამოქვეყნებამდე გამოაქვეყნეთ გვერდი.')}</p> : <>
            <textarea id={`${id}-post`} className="gk-input" rows={2} value={publication.attempt?.body.content ?? post} disabled={posting || !!publication.attempt} maxLength={400} onChange={event => setPost(event.target.value)} />
            {publication.attempt && <p role="status" className="gk-notice">{postCopy('Retry the original post to check its saved result.', 'შენახული შედეგის შესამოწმებლად ხელახლა გაგზავნეთ საწყისი პოსტი.')}</p>}
            <div className="gk-boxedit__foot" style={{ marginTop: 8 }}><Button size="sm" variant="primary" disabled={posting || !post.trim()} onClick={() => void publish()}>{publication.attempt ? postCopy('Retry original post', 'საწყისი პოსტის ხელახლა გაგზავნა') : t('Post it')}</Button><span className="gk-faint">{t('or skip it')}</span></div>
          </>}
        </div>
      </div>
    </SplitPanel>
  );
}
