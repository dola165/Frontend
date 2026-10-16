import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Crest } from '../../world/Crest';
import { acceptInvite, fetchInvite, type InviteLink } from '../api';
import { usePagesCopy } from '../copy';
import '../pages.css';

const ROLE_WORD: Record<InviteLink['role'], string> = { COACH: 'coach', ASSISTANT: 'assistant coach', ADMIN: 'club administrator' };

/** A coach or helper opening an invitation link: the page and the role, one button to join. No account needed first: the route signs them in or up. */
export function InvitePage() {
  const t = usePagesCopy();
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { refreshNavigationCapabilities } = useAuth();
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetchInvite(code, controller.signal).then(found => { if (!controller.signal.aborted) setInvite(found); }).catch(failure => { if (!controller.signal.aborted) setFailed(extractApiErrorMessage(failure, t('This invitation has expired. Ask for a new one.'))); });
    return () => controller.abort();
  }, [code, t]);
  const accept = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await acceptInvite(code); void refreshNavigationCapabilities().catch(() => undefined); navigate(result.profilePath); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Could not join. Try again.'))); setBusy(false); }
  };
  const role = invite ? t(ROLE_WORD[invite.role]) : '';
  const body = failed ? <Panel><EmptyNote title={failed} action={<ButtonLink to="/home">{t('Home')}</ButtonLink>} /></Panel>
    : !invite ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={56} /><Skeleton height={44} /></div>
    : <Panel padded>
      <div className="gk-cmatch__page"><Crest src={invite.page.crestUrl} name={invite.page.name} size={44} /><span className="gk-cmatch__text"><strong><Link to={invite.page.profilePath}>{invite.page.name}</Link></strong><small>{[invite.page.town, invite.squad?.name].filter(Boolean).join(' · ')}</small></span></div>
      <p style={{ marginTop: 12 }}>{invite.status === 'JOINED' ? t('This invitation was used.') : t('{name} invites you to join as {role}.', { name: invite.page.name, role })}</p>
      {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
      <div className="gk-boxedit__foot" style={{ marginTop: 12 }}>
        {invite.status === 'JOINED' ? <ButtonLink variant="primary" to={invite.page.profilePath}>{t('Open page')}</ButtonLink>
          : <Button variant="primary" disabled={busy} onClick={() => void accept()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null}{t('Join as {role}', { role })}</Button>}
        <ButtonLink variant="ghost" to={invite.page.profilePath}>{t('See the page first')}</ButtonLink>
      </div>
    </Panel>;
  return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={t('Invitation')} hint={invite ? invite.page.name : undefined}>{body}</Section></PageFrame></GkRoot>;
}
