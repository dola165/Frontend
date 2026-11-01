import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { ContactRows } from '../../pages/boxes/ContactRows';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { changePublication, getPresence } from './publicationApi';
import './home.css';

/** A current member's view of the same public identity; editing keeps the shared page's drafts and conflicts. */
export function OrganizationPresence({ id, canManage, blocked, onReload }: { id: number; canManage: boolean; blocked: boolean; onReload?: () => void }) {
  const copy = useJourneyCopy();
  const { sessionId, user } = useAuth();
  return <PresenceActor key={`${id}:${sessionId}:${user?.id}`} id={id} canManage={canManage} blocked={blocked} copy={copy} onReload={onReload} />;
}

function PresenceActor({ id, canManage, blocked, copy, onReload }: { id: number; canManage: boolean; blocked: boolean; copy: ReturnType<typeof useJourneyCopy>; onReload?: () => void }) {
  const { sessionId } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPresence>> | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const alive = useRef(false), pending = useRef(false);
  const current = () => alive.current && isCurrentAuthSession(sessionId);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void getPresence(id, controller.signal).then(value => {
      if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setData(value);
    }).catch(failure => {
      if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(failure, copy('Could not load the public profile.', 'საჯარო პროფილი ვერ ჩაიტვირთა.')));
    });
    return () => controller.abort();
  }, [id, sessionId, attempt, copy]);
  async function change() {
    if (!data || !canManage || pending.current || !current()) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const publication = await changePublication(id, data.publication, !data.publication.published, sessionId);
      if (!current()) return;
      setData({ ...data, publication }); setConfirm(false);
      setNotice(publication.published ? copy('Your public page is published.', 'თქვენი საჯარო გვერდი გამოქვეყნებულია.') : copy('Your public page is withdrawn. Your organization work remains available.', 'თქვენი საჯარო გვერდი მოხსნილია. ორგანიზაციის სამუშაო სივრცე ხელმისაწვდომია.'));
    } catch (failure) {
      if (!current()) return;
      promptEmailConfirmation(failure);
      setError(extractApiErrorMessage(failure, copy('Could not confirm the visibility change. Reload to check the current result.', 'ხილვადობის ცვლილება ვერ დადასტურდა. მიმდინარე შედეგის შესამოწმებლად განაახლეთ.')));
      // A lost response may already have changed visibility. Require a fresh read and decision.
      setData(null); setConfirm(false);
    } finally { pending.current = false; if (current()) setBusy(false); }
  }
  return <section className="org-setup-card org-presence" aria-label={copy('Public presence', 'საჯარო გვერდი')}>
    <h2>{copy('Public presence', 'საჯარო გვერდი')}</h2>
    {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => { setData(null); setError(''); setAttempt(value => value + 1); onReload?.(); }}>{copy('Reload', 'განახლება')}</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!data ? !error && <p role="status">{copy('Loading public profile…', 'საჯარო პროფილი იტვირთება…')}</p> : <>
      <p>{blocked ? copy('Public promotion is restricted. Organization work remains available.', 'საჯარო გავრცელება შეზღუდულია. ორგანიზაციის სამუშაო სივრცე ხელმისაწვდომია.') : data.publication.published ? copy('Published · people can view your page and contact details.', 'გამოქვეყნებულია · გვერდი და საკონტაქტო ინფორმაცია საჯაროა.') : copy('Private · visitors cannot open the public page.', 'პირადია · სტუმრები საჯარო გვერდს ვერ გახსნიან.')}</p>
      {data.publication.verificationStatus === 'VERIFIED' && <p>{copy('Verified organization', 'დადასტურებული ორგანიზაცია')}</p>}
      {!blocked && <ContactRows phone={data.profile.publicPhone} email={data.profile.publicEmail} website={data.profile.website} />}
      {!blocked && !data.profile.publicPhone && !data.profile.publicEmail && !data.profile.website && <p>{copy('No public contact details added.', 'საჯარო საკონტაქტო ინფორმაცია დამატებული არ არის.')}</p>}
      <div className="org-setup-actions">
        {canManage && !blocked && <Link className="org-setup-button" to={`/organizations/${id}?edit=1`}>{copy('Edit page and contacts', 'გვერდისა და კონტაქტების რედაქტირება')}</Link>}
        {canManage && (!blocked || data.publication.published) && <button type="button" disabled={busy} onClick={() => setConfirm(true)}>{data.publication.published ? copy('Withdraw public page', 'საჯარო გვერდის მოხსნა') : copy('Publish public page', 'საჯარო გვერდის გამოქვეყნება')}</button>}
      </div>
      {confirm && <div className="org-setup-notice"><p>{data.publication.published ? copy('Hide this page from visitors? Its saved details and your current responsibilities stay with the organization.', 'დაიმალოს გვერდი სტუმრებისთვის? შენახული ინფორმაცია და თქვენი მიმდინარე პასუხისმგებლობები ორგანიზაციაში დარჩება.') : copy('Publish the saved page and its contact details?', 'გამოქვეყნდეს შენახული გვერდი და საკონტაქტო ინფორმაცია?')}</p><div className="org-setup-actions"><button type="button" disabled={busy} onClick={() => void change()}>{copy('Confirm visibility change', 'ხილვადობის ცვლილების დადასტურება')}</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>{copy('Cancel', 'გაუქმება')}</button></div></div>}
    </>}
  </section>;
}
