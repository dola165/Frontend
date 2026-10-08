import { ClubRefereeChoices } from '../features/matchExchange/ClubRefereeChoices';
import { ChallengeJourneyProgress } from '../features/mapPlanning/ChallengeJourneyProgress';
import { useLoad, useAction, useClock } from "../features/matchExchange/hooks";
import { ChallengeResponse, OfficialRecruitment, OpponentRecovery } from '../features/matchExchange/OfficialRequests';
import { MatchParticipants } from '../features/matchExchange/MatchParticipants';
import { MatchReadiness } from '../features/clubOperations/MatchReadiness';
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Shield,
  MapPin,
  MessageCircle,
  UsersRound,
} from "lucide-react";
import { Back, LoadState, Status } from "../features/matchExchange/shared";
import {
  formats,
  label,
  post,
  when,
  type Match,
  type Referee,
  type Squad,
} from "../features/matchExchange/api";
import { AppointmentCard } from "../features/matchExchange/AppointmentCard";
import { FixtureCancellation, VenueFollowUp } from "../features/matchExchange/FixtureRecovery";
import { journeyLabel, matchTime, useJourneyCopy } from "../features/matchExchange/journeyCopy";
import { ListingEditor } from "../features/matchExchange/ListingEditor";
import { GroundArrangement } from "../features/matchExchange/GroundArrangement";
import { MatchShare } from "../features/matchExchange/MatchShare";
import { OfficialCoordination } from "../features/matchExchange/OfficialCoordination";
import { MatchResultSection } from "../features/matchExchange/MatchResultSection";
import { BroadcastPanel } from "../features/broadcasts/BroadcastPanel";
import { MatchHistoryLink } from "../features/matchHistory/MatchHistoryLink";
import { chatApi, type ConversationDto } from "../api/chat";
import "../features/matchExchange/match-detail-refinement.css";
export function MatchDetailPage() {
  const now = useClock();
  const { copy, language } = useJourneyCopy();
  const { eventId } = useParams();
  const {
      data: m,
      error,
      reload,
    } = useLoad<Match>(`/match-exchange/${eventId}`),
    { data: squads } = useLoad<Squad[]>("/match-exchange/squads");
  const { busy, run, feedback } = useAction(reload),
    [edit, setEdit] = useState(false),
    [proposalSquad, setProposalSquad] = useState(""),
    [note, setNote] = useState("");
  const [conversationLookup, setConversationLookup] = useState<{ eventId: number; conversation: ConversationDto | null }>();
  useEffect(() => {
    const event = m?.event_id;
    if (!event || !m?.can_arrange || m.listing_status !== "ARRANGED") return;
    const controller = new AbortController();
    void chatApi.findConversationByContext("MATCH_CHALLENGE", event, controller.signal)
      .then(conversation => { if (!controller.signal.aborted) setConversationLookup({ eventId: event, conversation }); })
      .catch(() => { if (!controller.signal.aborted) setConversationLookup({ eventId: event, conversation: null }); });
    return () => controller.abort();
  }, [m?.event_id, m?.can_arrange, m?.listing_status]);
  if (!m)
    return (
      <main className="mx-page">
        <Back />
        <LoadState error={error} reload={reload} />
      </main>
    );
  const active =
    ["OPEN", "ARRANGED"].includes(m.listing_status) &&
    m.event_status === "SCHEDULED" &&
    new Date(m.starts_at_iso).getTime() > now;
  const matchConversation = m.can_arrange && m.listing_status === "ARRANGED" && conversationLookup?.eventId === m.event_id
    ? conversationLookup.conversation
    : undefined;
  const eligible = squads?.filter((s) => s.club_id !== m.club_id) || [];
  const canPropose = m.listing_status === 'OPEN' && !m.requested_club_id && !m.can_manage && eligible.length > 0 && active;
  return (
    <main className="mx-page mx-detail mx-detail-refined">
      <Back />
      <header className="mx-head mx-detail-head">
        <div>
          <span className="mx-eyebrow">
            {m.age_group} · {formats[m.format]} · {label(m.level)}
          </span>
          <h1>{m.title}</h1>
          <div className="mx-actions">
            <Link to={`/clubs/${m.club_id}`}>{m.club_name}</Link>
            <span className="mx-muted">/ {m.squad_name}</span>
            <Status
              value={
                m.event_status === "COMPLETED" ? "COMPLETED" : m.listing_status
              }
            />
          </div>
        </div>
        <div className="mx-actions">
        {canPropose && <a className="mx-primary mx-proposal-jump" href="#match-proposal">{language.startsWith("ka") ? "მატჩის შეთავაზება" : "Propose a match"} <ArrowUpRight size={15}/></a>}
        <MatchHistoryLink clubId={m.club_id} squadId={m.squad_id} className="mx-button" />
        <MatchShare key={m.event_id} eventId={m.event_id} privateMatch={m.requested_club_id != null} />
        </div>
      </header>
      {feedback}
      {error && (
        <p role="alert" className="mx-error">
          {error}
        </p>
      )}
      {!edit && <div className="mx-match-lead">
        <div className="mx-match-score"><MatchResultSection match={m} reload={reload}/></div>
        <div className="mx-match-action">            <section className="mx-day-card"><p className="mx-eyebrow">Plan your match day</p><h2>{matchTime(m.starts_at_iso, m.timezone, language)}</h2><p className="mx-day-zone">{m.timezone}</p><div><MapPin size={20}/><span><strong>{m.location_name || 'Venue to be confirmed'}</strong><small>{m.city}</small></span></div><Link to={`/clubs/${m.club_id}?tab=teams&squad=${m.squad_id}`}>Meet the hosting squad<ArrowUpRight size={16}/></Link><Link to={`/calendar?scope=squad&squadId=${m.squad_id}`}><CalendarDays size={15}/>{copy("squadSchedule")}</Link>{m.venue_id && <Link to={`/stadiums/${m.venue_id}`}>Venue & directions<ArrowUpRight size={16}/></Link>}</section>            {m.can_respond && m.listing_status === "OPEN" && active && <ChallengeResponse match={m} squads={squads ?? []} reload={reload} />}
            {m.listing_status === "OPEN" && !m.requested_club_id &&
              !m.can_manage &&
              eligible.length > 0 &&
              active && (
                <section className="mx-panel mx-proposal-panel" id="match-proposal" tabIndex={-1}>
                  <h2>Propose a match</h2>
                  <form
                    className="mx-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        () =>
                          post(`/match-exchange/${m.event_id}/proposals`, {
                            squadId: Number(proposalSquad),
                            note,
                            revision: m.revision,
                          }),
                        "Proposal sent to the hosting squad",
                      );
                    }}
                  >
                    <label className="mx-wide">
                      Your squad
                      <select
                        required
                        value={proposalSquad}
                        onChange={(e) => setProposalSquad(e.target.value)}
                      >
                        <option value="">Choose a squad</option>
                        {eligible.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.club_name} · {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mx-wide">
                      Message to the coach
                      <textarea
                        value={note}
                        maxLength={2000}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Introduce your squad and confirm that the listed time and format work for you."
                      />
                    </label>
                    <footer>
                      <button
                        className="mx-primary"
                        disabled={busy || !proposalSquad}
                      >
                        Send proposal
                      </button>
                    </footer>
                  </form>
                </section>
              )}
            {!!m.proposals?.length && (
              <section className="mx-panel">
                <h2>{m.can_manage ? "Proposals" : "Your proposals"}</h2>
                {m.proposals.map((p) => (
                  <article className="mx-row" key={p.id}>
                    <div>
                      <Link to={`/clubs/${p.club_id}`}>{p.club_name}</Link>
                      <h3>{p.squad_name}</h3>
                      <p className="mx-prose">{p.note}</p>
                      <Status value={p.status} />
                    </div>
                    {p.status === "PENDING" && active && (
                      <div className="mx-actions">
                        {(m.can_manage
                          ? ["ACCEPT", "DECLINE"]
                          : ["WITHDRAW"]
                        ).map((a) => (
                          <button
                            key={a}
                            disabled={busy}
                            className={a === "ACCEPT" ? "mx-primary" : ""}
                            onClick={() =>
                              void run(
                                () =>
                                  post(
                                    `/match-exchange/${m.event_id}/proposals/${p.id}/decision`,
                                    { action: a, revision: m.revision },
                                  ),
                                a === "ACCEPT"
                                  ? "Proposal accepted"
                                  : a === "DECLINE"
                                    ? "Proposal declined"
                                    : "Proposal withdrawn",
                              )
                            }
                          >
                            {label(a)}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
</div>
            <section className="mx-panel mx-match-summary">
              <p className="mx-eyebrow">Match day</p><h2>{copy("matchDetails")}</h2>
              <div className="mx-facts">
                <span>
                  <CalendarDays size={17} />
                  {matchTime(m.starts_at_iso, m.timezone, language)} – {matchTime(m.ends_at_iso, m.timezone, language)}
                </span>
                <span>{m.timezone}</span>
                <span>
                  <MapPin size={17} />
                  {m.city} · {m.location_name}
                </span>
                <span>
                  <UsersRound size={17} />
                  {m.hosting_choice === 'NEUTRAL' ? 'Neutral ground' : m.venue_preference === "HOME"
                    ? "Hosting at home"
                    : m.venue_preference === "AWAY"
                      ? "Looking to travel"
                      : "Home or away"}
                </span>
              </div>
              <p className="mx-prose">
                {m.description ||
                  "Contact the hosting squad to agree the match details."}
              </p>
              {m.coach_name && (
                <p style={{ marginTop: 18 }} className="mx-muted">
                  Coach:{" "}
                  <Link to={`/profile/${m.head_coach_id}`}>{m.coach_name}</Link>
                </p>
              )}
              {m.venue_id && (
                <p style={{ marginTop: 15 }}>
                  <Link to={`/stadiums/${m.venue_id}`}>
                    View stadium and pitch availability →
                  </Link>
                </p>
              )}
              <div className="mx-actions" style={{ marginTop: 18 }}>
                <Link className="mx-button" to={`/clubs/${m.club_id}/squads`}>
                  View squad & academy
                </Link>
                {m.can_arrange && m.listing_status === "ARRANGED" && (
                  <Link className="mx-button" to={matchConversation ? `/messages?conversationId=${matchConversation.id}` : "/messages"}>
                    <MessageCircle size={16} /> {matchConversation ? "Open match conversation" : "Find match conversation"}
                  </Link>
                )}
              </div>
            </section>
      </div>}
      {!edit && <details className="mx-journey-disclosure"><summary>{language.startsWith('ka') ? 'მატჩის შეთანხმების ნაბიჯები' : 'Match arrangement steps'}</summary><ChallengeJourneyProgress match={m}/></details>}
      {edit ? (
        <ListingEditor
          initial={m}
          onClose={() => {
            setEdit(false);
            reload();
          }}
        />
      ) : (
        <div className="mx-layout mx-detail-layout">
          <aside className="mx-stack mx-detail-rail">
            <section className="mx-panel mx-readiness" aria-label={copy("readinessRegion")}>
              <div className="mx-readiness-lead">
                <h2>{copy("readiness")}</h2>
                <p className="mx-readiness-next">
                  {copy(m.event_status === "CANCELLED" ? "cancelled" : m.event_status === "COMPLETED" ? "finished"
                    : new Date(m.ends_at_iso).getTime() <= now ? "nextResult"
                    : !m.opponent_name ? "nextOpponent" : m.referee_status === "REPLACEMENT_NEEDED" ? (new Date(m.starts_at_iso).getTime() <= now ? "nextHostLate" : "nextHostReferee")
                    : !["BOOKED", "HOST_CONFIRMED"].includes(m.venue_status) ? "nextHostVenue"
                    : m.referee_status === "INVITED" ? "nextReferee" : m.referee_status === "NEEDED" ? "nextHostInvite" : "ready")}
                </p>
              </div>
              <dl className="mx-readiness-grid">
                <div><dt>{copy("opponent")}</dt><dd><Status value={m.event_status === "CANCELLED" ? "CANCELLED" : m.opponent_name ? "ACCEPTED" : "NEEDED"} />
                  {m.opponent_name && <Link to={`/clubs/${m.opponent_club_id}`}>{m.opponent_name} · {m.opponent_squad_name}</Link>}</dd></div>
                <div><dt>{copy("pitchVenue")}</dt><dd><Status value={m.venue_status} /></dd></div>
                <div><dt>{copy("officials")}</dt><dd>{m.referee_status === "REPLACEMENT_NEEDED" ? <strong>{copy("replacement")}</strong> : <Status value={m.event_status === "CANCELLED" ? "CANCELLED" : m.referee_status} />}</dd></div>
              </dl>
              {m.can_arrange && <div className="mx-readiness-coordination">
                <span>{copy("communication")}: <strong>{m.event_status === "CANCELLED" || m.event_status === "COMPLETED" ? copy("communicationClosed") : !m.opponent_name ? "After opponent agreement" : matchConversation === undefined ? "Checking…" : matchConversation ? "Ready" : "Available in Messages"}</strong></span>
                {m.listing_status === "ARRANGED" && m.opponent_name && matchConversation !== undefined && <Link to={matchConversation ? `/messages?conversationId=${matchConversation.id}` : "/messages"}>
                  {matchConversation ? "Open the exact match conversation" : "Open Messages to find this match conversation"}
                </Link>}
              </div>}
              {m.booking && <details className="mx-readiness-booking">
                <summary>{copy("coordinationDetails")}</summary>
                <p>Reservation #{m.booking.id}: {label(m.booking.status)}. {when(m.booking.starts_at)} – {when(m.booking.ends_at)}.
                  {" "}<Link to={`/stadiums/${m.booking.venue_id}`}>Manage at the stadium</Link></p>
              </details>}
            </section>
          </aside>
          <div className="mx-stack mx-detail-main">
            {m.own_appointments?.map(a => <AppointmentCard key={a.id} appointment={a} reload={reload} embedded />)}
            {(m.can_arrange || m.own_appointments?.some(a => a.status === "ACCEPTED")) && <OfficialCoordination eventId={m.event_id} />}
            {m.opponent_name && <details className="mx-panel"><summary>Broadcast & filming</summary><BroadcastPanel match={m} /></details>}
            <section className="mx-panel">
              <h2 className="mx-officials-title"><Shield size={20}/>{copy("matchOfficials")}</h2>
              {!m.appointments?.length ? (
                <p className="mx-muted">
                  {m.referee_required
                    ? "A referee is still needed."
                    : "A referee is optional for this match."}
                </p>
              ) : (
                m.appointments.filter(a => !m.own_appointments?.some(own => own.id === a.id)).map((a) => (
                  <article className="mx-row" key={a.id} id={`appointment-${a.id}`}>
                    <div>
                      <h3>
                        <Link to={`/profile/${a.referee_id}`}>
                          {a.full_name}
                        </Link>
                      </h3>
                      <p>
                        {label(a.duty)} ·{" "}
                        {a.volunteer
                          ? "Volunteering"
                          : a.fee != null
                            ? `${a.fee} ${a.currency}, agreed directly`
                            : "Paid appointment"}
                      </p>
                      <Status value={a.status} />
                      {a.attendance_issue && <p className="mx-notice"><strong>{copy("issueRecorded")}</strong><br />{a.attendance_issue}</p>}
                      {a.report && (
                        <details style={{ marginTop: 15 }}>
                          <summary>Match report</summary>
                          <p className="mx-prose">{a.report}</p>
                        </details>
                      )}
                    </div>
                    {m.can_arrange_official &&
                      active &&
                      ["INVITED", "ACCEPTED"].includes(a.status) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                post(
                                  `/match-exchange/${m.event_id}/referees/${a.id}/cancel`,
                                ),
                              "Appointment cancelled",
                            )
                          }
                        >
                          Cancel invitation
                        </button>
                      )}
                  </article>
                ))
              )}
              {m.can_arrange_official && active && (
                <RefereeInvite match={m} reload={reload} />
              )}
            </section>
            {m.external_referee_name && <section className="mx-panel"><h2>External referee</h2><p>{m.external_referee_name}</p><p className="mx-muted">Arranged outside GrassKickZ; reported by the coaching team.</p></section>}
            {m.can_arrange_official && active && <OfficialRecruitment match={m} reload={reload} />}
            {m.listing_status === 'ARRANGED' && <MatchParticipants match={m} reload={reload} />}
            {!!m.history?.length && <details className="mx-panel">
              <summary>{copy("arrangementHistory")}</summary>
              {m.history.map(item => <article className="mx-row" key={item.id}><div><strong>{journeyLabel(item.action, language)}</strong> · {when(item.created_at)}{item.reason && <p>{item.reason}</p>}</div></article>)}
            </details>}
          </div>
          <aside className="mx-stack mx-detail-rail mx-detail-rail-secondary">

            {(m.can_manage||m.can_arrange)&&<MatchReadiness key={m.event_id} event={m.event_id}/>}
            {m.can_manage && active && <section className="mx-panel">
              <button onClick={() => setEdit(true)}>{copy("editDetails")}</button>
            </section>}
            {active && <OpponentRecovery match={m} reload={reload} />}
            {m.can_arrange && active && <GroundArrangement match={m} reload={reload} />}
            {m.can_manage && m.event_status === "SCHEDULED" && m.listing_status !== "CLOSED" &&
              <FixtureCancellation match={m} reload={reload} started={new Date(m.starts_at_iso).getTime() <= now} />}
            {m.can_arrange && m.event_status === "CANCELLED" && m.venue_status === "NEEDS_ATTENTION" &&
              <VenueFollowUp match={m} reload={reload} />}
            <details className="mx-help"><summary>{copy("arrangementHelp")}</summary>
              <p>{copy("arrangementHelpBody")}</p><p>{copy("readinessNote")}</p>
            </details>
          </aside>
        </div>
      )}
    </main>
  );
}
export function RefereeInvite({
  match: m,
  reload,
}: {
  match: Match;
  reload: () => void;
}) {
  const [q, setQ] = useState(""),
    [volunteer, setVolunteer] = useState(false),
    [availableOnly, setAvailableOnly] = useState(false),
    [page, setPage] = useState(0),
    { data, error: searchError, reload: retrySearch } = useLoad<{ items: Referee[]; total: number }>(
      `/referees?${new URLSearchParams({ q, page: String(page), ...(volunteer ? { volunteer: 'true' } : {}), ...(availableOnly ? { from: m.starts_at_iso, to: m.ends_at_iso } : {}) })}`,
    ),
    [ref, setRef] = useState(""),
    [duty, setDuty] = useState("REFEREE"),
    [fee, setFee] = useState("0"),
    [currency, setCurrency] = useState("GEL"),
    { busy, run, feedback } = useAction(reload);
  const [clubReferee,setClubReferee]=useState<Referee|null>(null);
  const selected = clubReferee?.user_id===Number(ref)?clubReferee:data?.items.find(item => item.user_id === Number(ref));
  const acceptsTerms = selected && (volunteer ? selected.accepts_volunteer : selected.accepts_paid);
  return (
    <details style={{ marginTop: 20 }}>
      <summary>Invite a referee or assistant</summary>
      {feedback}
      <form
        className="mx-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!acceptsTerms || (searchError && !clubReferee)) return;
          void run(
            () =>
              post(`/match-exchange/${m.event_id}/referees`, {
                refereeId: Number(ref),
                duty,
                volunteer,
                fee: volunteer ? 0 : Number(fee),
                currency,
                revision: m.revision,
              }),
            "Invitation sent — awaiting referee acceptance",
          );
        }}
      >
        <ClubRefereeChoices squadId={m.referee_responsibility==='OPPONENT'?m.target_squad_id:m.squad_id} volunteer={volunteer} selectedId={Number(ref)} onSelect={r=>{setClubReferee(r);setRef(String(r.user_id));setFee(String(r.fee));setCurrency(r.currency);}}/>
        <label>
          Find a referee
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setRef(''); setPage(0); }}
            placeholder="Name or service area"
          />
        </label>
        <label className="mx-check mx-wide"><input type="checkbox" checked={availableOnly} onChange={event => { setAvailableOnly(event.target.checked); setRef(''); setPage(0); }} />Only referees with availability covering this match</label>
        <div className="mx-wide">
          {searchError ? <p role="alert">{searchError} <button type="button" onClick={retrySearch}>Retry referee search</button></p>
            : !data ? <p role="status">Loading referees…</p>
            : !data.items.length ? <p role="status">No referees match this search. Try another name or remove the availability filter. A referee can add availability before accepting your invitation.</p> : null}
          {data && data.total > 24 && <div className="mx-actions" aria-label="Referee search pages">
            <button type="button" disabled={!page} onClick={() => { setPage(value => value - 1); setRef(''); }}>Previous referees</button>
            <span>Page {page + 1} of {Math.ceil(data.total / 24)}</span>
            <button type="button" disabled={(page + 1) * 24 >= data.total} onClick={() => { setPage(value => value + 1); setRef(''); }}>Next referees</button>
          </div>}
        </div>
        <label>
          Referee
          <select
            required
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              const r = data?.items.find(
                (r) => r.user_id === Number(e.target.value),
              );
              if (r) {
                setFee(String(r.fee));
                setCurrency(r.currency);
              }
            }}
          >
            <option value="">Choose a referee</option>
            {clubReferee&&!data?.items.some(r=>r.user_id===clubReferee.user_id)&&<option value={clubReferee.user_id}>{clubReferee.full_name} · Club referee</option>}
            {data?.items.map((r) => (
              <option key={r.user_id} value={r.user_id} disabled={volunteer ? !r.accepts_volunteer : !r.accepts_paid}>
                {r.full_name} · {r.service_area}{!(volunteer ? r.accepts_volunteer : r.accepts_paid) ? ' · Does not accept these terms' : ''}
              </option>
            ))}
          </select>
        </label>
        {selected && <Link to={`/profile/${selected.user_id}`} target="_blank" rel="noopener noreferrer">Review referee profile (opens a new tab)</Link>}
        <label>
          Duty
          <select value={duty} onChange={(e) => setDuty(e.target.value)}>
            {["REFEREE", "ASSISTANT_1", "ASSISTANT_2"].map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="mx-check">
          <input
            type="checkbox"
            checked={volunteer}
            onChange={(e) => { setVolunteer(e.target.checked); setRef(''); setPage(0); }}
          />{" "}
          Volunteer invitation
        </label>
        {!volunteer && (
          <>
            <label>
              Offered fee
              <input
                required
                min={0}
                max={1000000}
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
            <label>
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["GEL", "EUR", "GBP", "USD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <p className="mx-muted mx-wide">
          Fees are agreed directly. Online payment is not active. The referee
          checks availability before accepting.
        </p>
        <footer>
          <button disabled={busy || !acceptsTerms || (!!searchError && !clubReferee)} className="mx-primary">
            Send invitation
          </button>
        </footer>
      </form>
    </details>
  );
}
