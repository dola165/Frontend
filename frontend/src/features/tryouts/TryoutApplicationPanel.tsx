import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { applicationContext, closePosting, submitApplication, withdrawApplication, type ApplicationContext } from './api';
import { postingLabel, tryoutDate, useTryoutCopy } from './tryoutCopy';

/** Remounted on account/session/tryout changes; every private request is bound to that session. */
export function TryoutApplicationPanel({ id, onChanged }: { id: number; onChanged: () => void }) {
  const { sessionId, refreshNavigationCapabilities } = useAuth();
  const copy = useTryoutCopy();
  const [data, setData] = useState<ApplicationContext | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [retry, setRetry] = useState(0);
  const [message, setMessage] = useState(''), [review, setReview] = useState<'apply' | 'withdraw' | 'CLOSED' | 'FILLED' | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true), mutation = useRef<AbortController | null>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => { if (review) reviewPanel.current?.focus(); }, [review]);
  useEffect(() => {
    const request = new AbortController();
    void applicationContext(id, sessionId, request.signal).then(result => {
      if (!request.signal.aborted) { setData(result); setLoading(false); }
    }).catch(e => {
      if (!request.signal.aborted) { setError(extractApiErrorMessage(e, 'Your application could not load. Refresh and try again.')); setLoading(false); }
    });
    const refresh = () => setRetry(n => n + 1);
    window.addEventListener('focus', refresh);
    return () => { request.abort(); window.removeEventListener('focus', refresh); };
  }, [id, sessionId, retry]);
  const reload = () => { setError(''); setLoading(true); setData(null); setRetry(n => n + 1); };
  const confirm = async () => {
    if (!review || mutation.current || !data) return;
    const request = new AbortController(); mutation.current = request; setBusy(true); setError(''); setNotice('');
    try {
      if (review === 'apply') await submitApplication(id, message, sessionId, request.signal);
      else if (review === 'withdraw' && data.application) await withdrawApplication(data.application.id, sessionId, request.signal);
      else if (review === 'CLOSED' || review === 'FILLED') await closePosting(id, review, sessionId, request.signal);
      if (!alive.current || request.signal.aborted) return;
      setReview(null);
      setNotice(copy('Saved. Your current receipt is shown below.', 'შენახულია. მიმდინარე ჩანაწერი მოცემულია ქვემოთ.'));
      reload(); onChanged();
      window.dispatchEvent(new Event('requests-updated'));
      void refreshNavigationCapabilities().catch(() => {});
    } catch (e) {
      if (alive.current && !request.signal.aborted) {
        setError(extractApiErrorMessage(e, copy('Could not save. Refresh the current status before trying again.', 'შენახვა ვერ მოხერხდა. ხელახლა ცდამდე განაახლეთ სტატუსი.')));
        setReview(null); setData(null); setRetry(n => n + 1);
      }
    } finally { mutation.current = null; if (alive.current) setBusy(false); }
  };
  const application = data?.application;
  return <section className="tryout-panel" aria-labelledby="tryout-application-heading">
    <h2 id="tryout-application-heading">{copy('Your application', 'თქვენი განაცხადი')}</h2>
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">{copy('Checking your current application…', 'მოწმდება თქვენი მიმდინარე განაცხადი…')}</p>}
    {error && <p role="alert">{error} <button type="button" onClick={reload} disabled={busy}>{copy('Refresh', 'განახლება')}</button></p>}
    {application && <div className="tryout-receipt">
      <p className="tryout-state">{postingLabel(application.status, copy)}</p>
      <p>{application.tryoutTitle}</p>
      <p>{copy('Applied', 'გაგზავნილია')}: {tryoutDate(application.appliedAt)}</p>
      {application.message && <p className="tryout-description">{application.message}</p>}
      {application.decisionMessage && <div><h3>{copy('Club response', 'კლუბის პასუხი')}</h3><p className="tryout-description">{application.decisionMessage}</p></div>}
      {application.status === 'ACCEPTED' && <p>{copy('The club recorded a trial relationship. Participation, guardian consent and any later playing registration are managed separately in Account.', 'კლუბმა საცდელი კავშირი დააფიქსირა. მონაწილეობა, მეურვის თანხმობა და შემდგომი რეგისტრაცია ცალკე იმართება ანგარიშში.')}</p>}
      {['PENDING', 'SHORTLISTED'].includes(application.status) && !review && <button type="button" onClick={() => setReview('withdraw')} disabled={busy}>{copy('Withdraw application', 'განაცხადის გაუქმება')}</button>}
      <Link to="/account?tab=profile">{copy('Open your club relationships', 'კლუბებთან კავშირების ნახვა')}</Link>
    </div>}
    {data && !application && !data.canApply && <p>
      {data.reason === 'PLAYER_IDENTITY_REQUIRED' ? copy('A player football identity is required. You can hold it alongside your other identities.', 'საჭიროა მოთამაშის საფეხბურთო იდენტობა. ის შეგიძლიათ გქონდეთ სხვა იდენტობებთან ერთად.')
        : data.reason === 'ALREADY_AFFILIATED' ? copy('You already have a current playing relationship with this club.', 'ამ კლუბთან უკვე გაქვთ მიმდინარე სათამაშო კავშირი.')
          : postingLabel(data.postingStatus, copy)}{' '}<Link to="/account?tab=profile">{copy('Review your profile', 'პროფილის ნახვა')}</Link>
    </p>}
    {data?.minorConsentRequired && <p className="tryout-help">{copy('An application does not give permission to participate. If the club accepts you for a trial, an accepted guardian must approve club participation before squad access begins.', 'განაცხადი მონაწილეობის უფლებას არ იძლევა. სინჯზე მიღების შემდეგ მეურვემ უნდა დაამტკიცოს კლუბში მონაწილეობა, სანამ გუნდის წვდომა ჩაირთვება.')}</p>}
    {data?.canApply && !review && <form onSubmit={e => { e.preventDefault(); setReview('apply'); }}>
      <label>{copy('Message to the club (optional)', 'შეტყობინება კლუბს (არასავალდებულო)')}<textarea maxLength={1000} rows={4} value={message} onChange={e => setMessage(e.target.value)} disabled={busy} /></label>
      <p className="tryout-help">{copy('The club’s current reviewers can see your player profile and this message. Do not include private medical or guardian information.', 'კლუბის უფლებამოსილი თანამშრომლები ნახავენ თქვენს მოთამაშის პროფილსა და ამ შეტყობინებას. არ მიუთითოთ პირადი სამედიცინო ან მეურვის ინფორმაცია.')}</p>
      <button className="tryout-primary" type="submit" disabled={busy}>{copy('Review application', 'განაცხადის გადახედვა')}</button>
    </form>}
    {review && <div ref={reviewPanel} tabIndex={-1} className="tryout-confirm" role="group" aria-label={copy('Confirm your action', 'მოქმედების დადასტურება')}>
      <h3>{review === 'apply' ? copy('Send your application?', 'გაგზავნოთ განაცხადი?') : review === 'withdraw' ? copy('Withdraw this application?', 'გააუქმოთ ეს განაცხადი?') : copy('Stop new applications?', 'შეწყდეს ახალი განაცხადების მიღება?')}</h3>
      <p>{review === 'apply' ? copy('The club will review your interest. Applying does not join the club or grant squad access.', 'კლუბი განიხილავს თქვენს ინტერესს. განაცხადი კლუბის წევრობას ან გუნდის წვდომას არ გაძლევთ.')
        : review === 'withdraw' ? copy('The club will be notified. Your receipt is retained and you cannot apply to this same tryout again.', 'კლუბი მიიღებს შეტყობინებას. ჩანაწერი შენარჩუნდება და ამავე სინჯზე ხელახლა განაცხადს ვეღარ შეიტანთ.')
          : copy('Existing applicants remain available for review. This posting cannot be reopened; publish a new tryout for a later intake.', 'არსებული განაცხადების განხილვა კვლავ შესაძლებელი იქნება. განცხადება აღარ გაიხსნება; შემდეგი მიღებისთვის გამოაქვეყნეთ ახალი სინჯი.')}</p>
      {review === 'apply' && message.trim() && <p className="tryout-description">{message.trim()}</p>}
      {(review === 'CLOSED' || review === 'FILLED') && <p>{postingLabel(review, copy)}</p>}
      <div className="tryout-actions"><button type="button" className="tryout-primary" disabled={busy} onClick={() => void confirm()}>{busy ? copy('Saving…', 'ინახება…') : review === 'apply' ? copy('Send application', 'განაცხადის გაგზავნა') : copy('Confirm', 'დადასტურება')}</button>
        <button type="button" disabled={busy} onClick={() => setReview(null)}>{copy('Go back', 'უკან დაბრუნება')}</button></div>
    </div>}
    {data?.canManage && data.postingStatus === 'OPEN' && !review && <details className="tryout-management"><summary>{copy('Manage applications', 'განაცხადების მართვა')}</summary>
      <p>{copy('Close new applications when recruitment ends, or record that the available places are filled.', 'დაასრულეთ განაცხადების მიღება ან მიუთითეთ, რომ ხელმისაწვდომი ადგილები შევსებულია.')}</p>
      <div className="tryout-actions"><button type="button" disabled={busy} onClick={() => setReview('CLOSED')}>{copy('Close applications', 'განაცხადების მიღების დახურვა')}</button><button type="button" disabled={busy} onClick={() => setReview('FILLED')}>{copy('Mark places filled', 'ადგილების შევსებულად მონიშვნა')}</button></div>
    </details>}
    <Link to="/requests">{copy('All requests and history', 'ყველა მოთხოვნა და ისტორია')}</Link>
  </section>;
}
