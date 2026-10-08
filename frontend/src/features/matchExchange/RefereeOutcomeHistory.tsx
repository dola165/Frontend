import { EmptyState } from '../../components/ui/EmptyState';
import { Flag, Send } from 'lucide-react';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRefereeHistory as useLoad } from "./useRefereeHistory";
import { withdrawOfficialOffer, type Appointment, type OfficialOffer, type RefereePageResult } from "./api";
import { AppointmentCard } from "./AppointmentCard";
import { Status } from "./shared";

function Pager({ page, total, pageSize, to }: { page: number; total: number; pageSize: number; to: (page: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  return pages > 1 ? <nav className="mx-actions" aria-label="History pages"><button disabled={!page} onClick={() => to(page - 1)}>Newer</button><span className="mx-muted">Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => to(page + 1)}>Earlier</button></nav> : null;
}
export function RefereeAppointmentHistory({ reloadAppointment }: { reloadAppointment: () => void }) {
  const { search } = useLocation(), navigate = useNavigate(); const page = Math.max(0, Number(new URLSearchParams(search).get("historyPage") || 0) || 0);
  const { data, error, reload } = useLoad<RefereePageResult<Appointment>>(`/referees/me/appointments/history?page=${page}`);
  return <section className="mx-stack" aria-label="Appointment history">{error && <div><p role="alert" className="mx-error">{error}</p><button onClick={reload}>Try again</button></div>}{!data ? !error && <p className="mx-panel">Loading appointment history…</p> : data.items.length ? data.items.map(item => <AppointmentCard key={item.id} appointment={item} reload={() => { reload(); reloadAppointment(); }} />) : <EmptyState icon={Flag} title="No appointment history yet." description="Past appointments and recorded decisions will stay here, so you can return to match details and reports." action={{label:"View current assignments",to:"#invitations"}}/>} {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} to={next => navigate(`?historyPage=${next}#history`)} />}</section>;
}
export function ExactRefereeAppointment({ appointmentId, reloadAppointment }: { appointmentId: number; reloadAppointment: () => void }) {
  const { data, error, reload } = useLoad<Appointment>(`/referees/me/appointments/${appointmentId}`);
  if (!data) return error ? <section className="mx-panel"><p role="alert" className="mx-error">{error}</p><button onClick={reload}>Try again</button></section> : <p className="mx-panel">Loading your appointment…</p>;
  return <AppointmentCard appointment={data} reload={() => { reload(); reloadAppointment(); }} />;
}
export function RefereeOfferHistory() {
  const { hash, search } = useLocation(), navigate = useNavigate(); const page = Math.max(0, Number(new URLSearchParams(search).get("offerPage") || 0) || 0);
  const { sessionId } = useAuth(); const [busyOffer, setBusyOffer] = useState<number>(); const [withdrawError, setWithdrawError] = useState(""); const withdrawal = useRef<AbortController | undefined>(undefined); const inFlight = useRef(false);
  useEffect(() => () => { withdrawal.current?.abort(); inFlight.current = false; }, [sessionId, hash, page]);
  const exactId = /^#offer-([1-9]\d*)$/.exec(hash)?.[1];
  const { data, error, reload } = useLoad<RefereePageResult<OfficialOffer> | OfficialOffer>(exactId ? `/referees/me/offers/${exactId}` : `/referees/me/offers?page=${page}`);
  const offers = data ? ("items" in data ? data.items : [data]) : [];
  const terms = (label: string, value: OfficialOffer["originalTerms"]) => value ? <p><strong>{label}:</strong> {value.volunteer ? "Volunteer" : `${value.fee} ${value.currency}`}<br/>{new Date(value.startsAt).toLocaleString(undefined, { timeZone: value.timezone })} – {new Date(value.endsAt).toLocaleTimeString(undefined, { timeZone: value.timezone, hour: "2-digit", minute: "2-digit" })} · {value.timezone}<br/>{value.locationName} · {value.city}</p> : <p><strong>{label}:</strong> Terms were not recorded for this earlier offer.</p>;
  async function withdraw(offerId: number) {
    if (inFlight.current || !window.confirm("Withdraw this offer?")) return;
    inFlight.current = true;
    const controller = new AbortController(); withdrawal.current = controller;
    setBusyOffer(offerId); setWithdrawError("");
    try {
      await withdrawOfficialOffer(offerId, controller.signal, sessionId);
      if (!controller.signal.aborted) reload();
    } catch {
      if (!controller.signal.aborted) { setWithdrawError("Could not withdraw this offer. Refresh and try again."); reload(); }
    } finally {
      if (withdrawal.current === controller) { inFlight.current = false; setBusyOffer(undefined); }
    }
  }
  return <section className="mx-stack" aria-label="Your referee offers"><section className="mx-panel"><h2>My referee offers</h2><p className="mx-muted">Each offer keeps the terms you submitted and its recorded outcome.</p>{(error || withdrawError) && <div><p role="alert" className="mx-error">{error || withdrawError}</p><button onClick={reload}>Refresh offers</button></div>}{!data ? !error && <p>Loading offers…</p> : !offers.length ? <EmptyState compact icon={Send} title="No offers yet." description="Offer to officiate an open match request. Your submitted terms and the club’s response will appear here." action={{label:"Find a match",to:"#open-requests"}}/> : <div className="mx-official-list">{offers.map(offer => <article key={offer.id} id={`offer-${offer.id}`} className={hash === `#offer-${offer.id}` ? "mx-offer-target" : undefined}><header><strong>{offer.originalTerms?.title || offer.changedTerms?.title || "Earlier referee offer"}</strong><Status value={offer.status}/></header>{terms("Original terms", offer.originalTerms)}{offer.changedTerms && terms("Current terms", offer.changedTerms)}{offer.outcomeReason && <p className="mx-muted">{offer.outcomeReason}</p>}{offer.appointmentPath && <Link className="mx-button" to={offer.appointmentPath}>Open your appointment</Link>}{offer.canWithdraw && <button disabled={busyOffer !== undefined} onClick={() => void withdraw(offer.id)}>{busyOffer === offer.id ? "Withdrawing…" : "Withdraw offer"}</button>}</article>)}</div>}{data && "items" in data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} to={next => navigate(`?offerPage=${next}#offers`)} />}</section></section>;
}
