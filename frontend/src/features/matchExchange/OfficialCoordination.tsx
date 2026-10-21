import { EmptyState } from '../../components/ui/EmptyState';
import { MessagesSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { MessageCircle, Send } from "lucide-react";
import { MessageText } from "../../components/chat/MessageText";
import { useAuth } from "../../context/AuthContext";
import { extractApiErrorMessage } from "../../utils/apiError";
import { getOfficialCoordination, sendOfficialCoordination, type OfficialCoordination } from "./api";

export function OfficialCoordination({ eventId }: { eventId: number }) {
  const { sessionId } = useAuth(); const [state, setState] = useState<OfficialCoordination>(); const [error, setError] = useState(""); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const page = useRef(0), requestId = useRef(crypto.randomUUID()), loadController = useRef<AbortController | undefined>(undefined), sendController = useRef<AbortController | undefined>(undefined), inFlight = useRef(false), activeRef = useRef("");
  const active = `${sessionId ?? "anonymous"}:${eventId}`;
  const visibleState = activeRef.current === active ? state : undefined;
  const clearIfPrivate = (cause: unknown) => { if (isAxiosError(cause) && [403, 404].includes(cause.response?.status || 0)) { setState(undefined); setBody(""); } };
  const load = useCallback(async (target = 0, prepend = false) => {
    loadController.current?.abort(); const controller = new AbortController(); loadController.current = controller; const request = activeRef.current; setError("");
    try { const result = await getOfficialCoordination(eventId, target, controller.signal, sessionId); if (controller.signal.aborted || activeRef.current !== request) return; page.current = target; setState(current => prepend && current ? { ...result, messages: [...new Map([...result.messages, ...current.messages].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id) } : result); }
    catch (cause) { if (controller.signal.aborted || activeRef.current !== request) return; clearIfPrivate(cause); setError(extractApiErrorMessage(cause, "Could not load the officials’ coordination.")); }
  }, [eventId, sessionId]);
  useEffect(() => {
    activeRef.current = active; page.current = 0; requestId.current = crypto.randomUUID(); inFlight.current = false; setState(undefined); setError(""); setBody(""); setBusy(false); void load(0);
    const refresh = () => { if (document.visibilityState === "visible" && !inFlight.current) void load(0); }; window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => { if (page.current === 0) refresh(); }, 15000);
    return () => { activeRef.current = ""; loadController.current?.abort(); sendController.current?.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [active, load]);
  async function send() {
    const value = body.trim(), request = activeRef.current; if (!value || inFlight.current || !visibleState || visibleState.readOnly) return;
    inFlight.current = true; setBusy(true); setError(""); const controller = new AbortController(); sendController.current = controller;
    try { const message = await sendOfficialCoordination(eventId, value, requestId.current, controller.signal, sessionId); if (controller.signal.aborted || activeRef.current !== request) return; requestId.current = crypto.randomUUID(); setBody(""); setState(current => current ? { ...current, totalElements: current.totalElements + (current.messages.some(item => item.id === message.id) ? 0 : 1), messages: current.messages.some(item => item.id === message.id) ? current.messages : [...current.messages, message] } : current); }
    catch (cause) { if (!controller.signal.aborted && activeRef.current === request) { clearIfPrivate(cause); setError(extractApiErrorMessage(cause, "Could not send the message. Please try again.")); } }
    finally { if (activeRef.current === request) { inFlight.current = false; setBusy(false); } }
  }
  if (!visibleState && !error) return <section id="coordination" className="mx-panel mx-official-coordination" aria-busy="true"><h2><MessageCircle size={18}/> Officials’ coordination</h2><p>Loading coordination…</p></section>;
  if (!visibleState) return <section id="coordination" className="mx-panel mx-official-coordination"><h2><MessageCircle size={18}/> Officials’ coordination</h2><p role="alert" className="mx-error">{error}</p><button onClick={() => void load(0)}>Try again</button></section>;
  return <section id="coordination" className="mx-panel mx-official-coordination" aria-label="Officials’ coordination"><header><div><h2><MessageCircle size={18}/> Officials’ coordination</h2><p className="mx-muted">Only appointed officials and responsible staff can read this match thread.</p></div><span className="mx-muted">{visibleState.totalElements} messages</span><button disabled={busy} onClick={() => void load(0)}>Refresh discussion</button></header><p className="mx-coordination-members">{visibleState.participants.map(person => `${person.fullName} (${person.role === "OFFICIAL" ? person.duty || "Official" : person.squadName || "Staff"})`).join(" · ")}</p>{error && <p role="alert" className="mx-error">{error}</p>}{visibleState.hasMore && <button className="mx-link-button" disabled={busy} onClick={() => void load(page.current + 1, true)}>Load earlier messages</button>}<div className="mx-coordination-log" role="log" aria-live="polite">{visibleState.messages.length ? visibleState.messages.map(message => <article key={message.id}><header><strong>{message.authorName}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></header><p><MessageText text={message.body}/></p></article>) : <EmptyState compact icon={MessagesSquare} title="No coordination messages yet." description={visibleState.readOnly ? "No discussion was recorded before this fixture was cancelled." : "Agree arrival times, kit or match preparations with the appointed officials and responsible staff."}/>}</div>{visibleState.readOnly ? <p className="mx-notice">This fixture is cancelled. Its officials’ discussion is retained for responsible staff.</p> : <form className="mx-coordination-compose" onSubmit={event => { event.preventDefault(); void send(); }}><label>Message to the match officials<textarea value={body} maxLength={2000} disabled={busy} onChange={event => setBody(event.target.value)} /></label><button className="mx-primary" disabled={busy || !body.trim()}><Send size={16}/> {busy ? "Sending…" : "Send message"}</button></form>}</section>;
}
