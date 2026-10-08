import { DolaResizeHandle } from './DolaResizeHandle';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, BookOpen, CalendarDays, Check, Compass, MessageCircle, Plus, Sparkles, PanelRightOpen, Maximize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeDolaDestination } from './api';
import { useDola } from './DolaContext';
import './agent-dola.css';
import { DolaActionCard } from './DolaActionCard';
import { HomeOpportunities } from '../../components/layout/HomeOpportunities';
import { dolaSuggestions, dolaContextLabel, dolaFollowUps, type DolaWorkspace } from './suggestions';

export function AgentDolaPage() { return <DolaConversation />; }
export function DolaDock() {
    const dola = useDola();
    if (!dola.visible || !dola.panel || dola.fullPage) return null;
    return <aside className="dola-dock" role="dialog" aria-label="Agent Dola sidebar" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); dola.closePanel(); }
        if (event.key === 'Tab' && window.matchMedia('(max-width: 680px)').matches) {
            const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea:not(:disabled), input:not(:disabled), summary'));
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }}><DolaResizeHandle /><DolaConversation panel /></aside>;
}
function DolaConversation({ panel = false }: { panel?: boolean }) {
    const location = useLocation();
    const { i18n } = useTranslation(); const ka = i18n.language?.startsWith('ka');
    const { available, turns, draft, setDraft, personal, setPersonal, busy, error, expired, resume, loading, submit,
        newConversation, continueConversation, closePanel, dock, expand, keepOpen, contexts, workspace, setWorkspace, welcomeLoading } = useDola();
    const composer = useRef<HTMLTextAreaElement>(null); const end = useRef<HTMLDivElement>(null);
    const recoveryButton = useRef<HTMLButtonElement>(null);
    const follow = useRef(true);
    useEffect(() => { if (follow.current) end.current?.scrollIntoView?.({ block: 'nearest' }); }, [turns, busy]);
    useEffect(() => { if (resume) recoveryButton.current?.focus(); else composer.current?.focus(); }, [panel, resume]);
    const suggestions = dolaSuggestions(workspace, !!ka);
    return <div className={`dola-page ${panel ? 'dola-page--panel' : ''}`}>
        <aside className="dola-about">
            <Link to="/home" className="dola-back">GrassKickZ <ArrowUpRight size={14} /></Link>
            <div className="dola-mark"><Sparkles size={27} strokeWidth={1.5} /></div>
            <span className="dola-eyebrow">{ka ? 'თქვენი საფეხბურთო ასისტენტი' : 'Your football assistant'}</span>
            <h1>Agent Dola<span>.</span></h1>
            <p className="dola-intro">{ka ? 'იპოვეთ სწორი გვერდი. გაიგეთ შემდეგი ნაბიჯი.' : 'Find answers. Get things done.'}</p>
            <div className="dola-abilities">
                <p><Compass size={18} /><span>{ka ? 'გზამკვლევი GrassKickZ-ში' : 'Your football work, in context'}</span></p>
                <p><BookOpen size={18} /><span>{ka ? 'პასუხები პროდუქტის გზამკვლევიდან' : 'Useful actions, ready to review'}</span></p>
                <p><CalendarDays size={18} /><span>{ka ? 'თქვენი კალენდარი — სურვილისამებრ' : 'Family, squads, refereeing and organisations'}</span></p>
            </div>
            <div className="dola-scope"><span className="dola-pilot">{ka ? 'საწყისი ვერსია' : 'EARLY ACCESS'}</span><p>{ka ? 'Dola კითხულობს გუნდის ინფორმაციას და ამზადებს მოქმედებებს. ცვლილებამდე თქვენ ამოწმებთ და ადასტურებთ ზუსტ დეტალებს.' : 'Dola reads the workspaces you can access and prepares useful actions. You review and confirm the exact details before anything changes.'}</p></div>
        </aside>
        <section className="dola-conversation" aria-label="Agent Dola conversation">
            <header className="dola-heading"><span><Sparkles size={18} /> Agent Dola</span><div className="dola-controls">
                <button type="button" title={ka ? 'ახალი საუბარი' : 'New conversation'} aria-label={ka ? 'ახალი საუბარი' : 'New conversation'} onClick={() => void newConversation()} disabled={busy || loading || turns.length === 0 && !expired && !resume}><Plus size={17} /></button>
                <button type="button" title={panel ? 'Open full page' : 'Move chat to sidebar'} aria-label={panel ? 'Open full page' : 'Move chat to sidebar'} onClick={panel ? expand : dock}>{panel ? <Maximize2 size={16} /> : <PanelRightOpen size={18} />}</button>
                {panel && <button type="button" title="Close chat" aria-label="Close chat" onClick={closePanel}><X size={18} /></button>}
            </div></header>
            {panel && location.pathname === '/home' && <HomeOpportunities className="home-opportunities--panel" onNavigate={keepOpen} />}
            {contexts.length > 1 && <label className="dola-context-select"><span>{ka ? 'კონტექსტი' : 'Helping with'}</span><select aria-label={ka ? 'Dola-ს კონტექსტი' : 'Dola context'} value={workspace} disabled={busy || welcomeLoading} onChange={event => setWorkspace(event.target.value as DolaWorkspace)}>{contexts.map(context => <option key={context} value={context}>{dolaContextLabel(context, !!ka)}</option>)}</select></label>}
            <div className="dola-thread" role="log" aria-label={ka ? 'საუბარი' : 'Conversation'} aria-live={busy ? 'off' : 'polite'} onScroll={event => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
                {resume && <div className="dola-resume"><span className="dola-orbit"><MessageCircle size={23} /></span><h2>{ka ? 'გავაგრძელოთ წინა საუბარი?' : 'Pick up where you left off?'}</h2><p>{ka ? 'ბოლო საუბარი ინახება ბოლო შეტყობინებიდან 45 წუთით.' : 'Your latest chat is available for 45 minutes after your last message.'}</p><button type="button" className="dola-resume-primary" ref={recoveryButton} onClick={continueConversation}>{ka ? 'საუბრის გაგრძელება' : 'Continue last chat'}</button><button type="button" disabled={busy || loading} onClick={() => void newConversation()}>{ka ? 'ახალი საუბრის დაწყება' : 'Start new'}</button></div>}
                {!resume && !turns.length && <div className="dola-welcome"><span className="dola-orbit"><Sparkles size={23} /></span><h2>{ka ? 'რით დაგეხმაროთ?' : 'What would you like to get done?'}</h2><p>{ka ? 'მკითხეთ კლუბებზე, გუნდებზე ან შემდეგ ნაბიჯზე. შეგიძლიათ ქართულადაც მომწეროთ.' : 'Start with what matters to you. Ask in English or Georgian, and switch context whenever you need.'}</p><div className="dola-suggestions">{!welcomeLoading && suggestions.map(suggestion => <button key={suggestion} disabled={busy} onClick={() => { setDraft(suggestion); composer.current?.focus(); }}>{suggestion}<ArrowUpRight size={16} /></button>)}</div></div>}
                {!resume && turns.map((turn, index) => <div className="dola-turn" key={index}><div className="dola-question">{turn.question}</div>{(turn.result || turn.partial) && <article className="dola-answer"><span className="dola-author"><Sparkles size={15} /> Agent Dola</span><p>{turn.result?.answer ?? turn.partial}{!turn.result && <span className="dola-cursor" aria-hidden="true" />}</p>{turn.result?.destinations.filter(safeDolaDestination).map(destination => <Link className="dola-destination" key={destination.id} to={destination.path} onClick={keepOpen}>{destination.title}<ArrowUpRight size={16} /></Link>)}{turn.result?.actions?.map(action => <DolaActionCard key={action.id} action={action} ka={!!ka} />)}{turn.result && index === turns.length - 1 && !busy && <div className="dola-follow-ups">{dolaFollowUps(turn.result.followUps, !!ka).map(prompt => <button type="button" key={prompt} onClick={() => { setDraft(prompt); composer.current?.focus(); }}>{prompt}<ArrowUpRight size={14} /></button>)}</div>}{turn.result && turn.result.sources.length > 0 && <details className="dola-sources"><summary><BookOpen size={13} /> {ka ? 'პასუხისთვის მიწოდებული წყაროები' : 'Guide references supplied'}</summary>{turn.result.sources.map(source => <div key={source.id}><strong>{source.title}</strong><small>{source.reviewedAt}</small><p>{source.text}</p></div>)}</details>}</article>}</div>)}
                {busy && !resume && <p role="status" className="dola-thinking"><span />{ka ? 'Dola პასუხს ამზადებს…' : 'Dola is working on your answer…'}</p>}
                <div ref={end} />
            </div>
            <footer className="dola-compose">
                {(available === null || loading) && <p role="status" className="dola-notice">{ka ? 'მოწმდება კავშირი…' : 'Checking availability…'}</p>}
                {available === false && <p role="status" className="dola-notice">{ka ? 'Agent Dola ამ სერვერზე ჯერ არ არის ხელმისაწვდომი.' : 'Agent Dola is not available on this server yet. You can still use GrassKickZ as usual.'}</p>}
                {error && <p role="alert" className="dola-error">{error}</p>}
                <form onSubmit={event => { event.preventDefault(); follow.current = true; void submit(draft); }}>
                    <label htmlFor="dola-message" className="sr-only">{ka ? 'შეტყობინება Agent Dola-ს' : 'Message Agent Dola'}</label>
                    <div className="dola-input-wrap"><textarea id="dola-message" ref={composer} rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={ka ? 'ჰკითხეთ Agent Dola-ს…' : 'Ask Agent Dola…'} disabled={busy || resume || loading} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" aria-label={ka ? 'გაგზავნა' : 'Send message'} disabled={busy || loading || resume || !available || expired || !draft.trim()}><ArrowUp size={21} /></button></div>
                    <label className="dola-personal"><input type="checkbox" checked={personal} disabled={busy || resume} onChange={event => setPersonal(event.target.checked)} /><span className="dola-checkbox"><Check size={12} /></span><span>{ka ? 'საჭიროებისას ჩემი პირადი კალენდრის გამოყენება' : 'Allow my personal calendar when needed'}</span></label>
                    <p className="dola-privacy">{ka ? 'Dola ითვალისწინებს თქვენს სამუშაო სივრცეებზე წვდომას. ტექსტსა და შესაბამის კონტექსტს ამუშავებს DeepSeek და TypeSafe. მოთხოვნისას იკითხება გუნდის განახლებები, ნებადართული სახელები, დანიშვნები, მოედნის ჯავშნები და მოთხოვნილი საკონტაქტო ინფორმაცია; პირადი ჩატები და ბავშვის სრული პროფილი გამორიცხულია. საუბარი ინახება 45 წუთით. მოქმედება დადასტურებამდე შეამოწმეთ.' : 'Dola uses your current workspace access. Messages and relevant context are processed by DeepSeek and TypeSafe. Requested reads may include squad updates, permitted names, appointments, venue bookings and explicitly requested customer contacts; private chats and full child profiles are excluded. Chats expire after 45 minutes. Review actions before confirming.'}</p>
                </form>
            </footer>
        </section>
    </div>;
}
