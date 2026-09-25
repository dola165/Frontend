import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { CareerForm, CareerTimeline, MatchHistory, ProfileEditor } from '../../pages/RefereePage';
import { useAction } from '../matchExchange/hooks';
import { formats, remove, type Referee } from '../matchExchange/api';
import { isProfessionalRole, profileRoles, type FootballProfile, type RoleProfile } from './domain';
import { ProfessionalCareer } from './ProfessionalCareer';
import { AgentCareer } from './AgentCareer';
import '../matchExchange/match-exchange.css';

type Profile = { id: number; role: string; isPrivate?: boolean; roleProfiles?: RoleProfile[]; footballProfile?: FootballProfile | null };
type CoachingRole = { club_id: number; club_name: string; logo_url: string | null; title: string; biography: string | null; qualifications: string | null; member_since: string | null; squads_json: string };

function useCareer<T>(path: string) {
    const [data, setData] = useState<T | null>();
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<T>(path, { signal: controller.signal }).then(response => {
            if (!controller.signal.aborted) { setData(response.data); setError(''); }
        }).catch((reason: { response?: { status: number } }) => {
            if (!controller.signal.aborted) {
                if (reason.response?.status === 404) setData(null);
                else setError('Career details could not load. Please try again.');
            }
        });
        return () => controller.abort();
    }, [path, revision]);
    return { data, error, reload: () => { setError(''); setRevision(value => value + 1); } };
}

export function ProfileCareer({ profile, isMyProfile, compact = false, onChanged }: { profile: Profile; isMyProfile: boolean; compact?: boolean; onChanged?: (profile: FootballProfile) => void }) {
    if (profile.isPrivate && !isMyProfile) return null;
    const roles = new Set(profileRoles(profile));
    if (profile.footballProfile && ![...roles].some(isProfessionalRole) && !(isMyProfile && profile.footballProfile.entries.length)) return null;
    if (profile.footballProfile) return <div id="career" className="mx-page mx-profile-career">
        <ProfessionalCareer initial={profile.footballProfile} userId={profile.id} own={isMyProfile} compact={compact} showEmpty={!roles.has('REFEREE')} onChanged={onChanged} />
        {!compact && roles.has('REFEREE') && <RefereeingCareer key={`referee-${profile.id}-${isMyProfile}`} id={profile.id} own={isMyProfile} careerEditor={false} />}
        {!compact && roles.has('AGENT') && <AgentCareer id={profile.id} own={isMyProfile} />}
    </div>;
    return <div id="career" className="mx-page mx-profile-career">
        <CoachingCareer key={`coach-${profile.id}-${isMyProfile}`} id={profile.id} showEmpty={roles.has('COACH')} />
        {roles.has('REFEREE') && <RefereeingCareer key={`referee-${profile.id}-${isMyProfile}`} id={profile.id} own={isMyProfile} />}
        {roles.has('AGENT') && <AgentCareer id={profile.id} own={isMyProfile} />}
    </div>;
}

function CoachingCareer({ id, showEmpty }: { id: number; showEmpty: boolean }) {
    const { data, error, reload } = useCareer<CoachingRole[]>(`/users/${id}/coaching-career`);
    if (!showEmpty && !data?.length) return null;
    return <section className="mx-panel" aria-label="Coaching career">
        <h2>Coaching career</h2>
        <p className="mx-muted">Club roles, coaching teams and qualifications.</p>
        {error ? <p role="alert">{error} <button onClick={reload}>Retry</button></p> : data === undefined ? <p role="status">Loading coaching experience…</p> : !data?.length ? <p className="mx-muted">No club coaching roles published yet.</p> : data.map(entry => {
            const squads = JSON.parse(entry.squads_json) as { id: number; name: string }[];
            return <article className="mx-coaching-entry" key={entry.club_id}>
                <div className="mx-identity">
                    <span className="mx-career-club-logo">{entry.logo_url ? <MediaImage src={resolveMediaUrl(entry.logo_url)} alt="" loading="lazy" /> : entry.club_name.slice(0, 2).toUpperCase()}</span>
                    <div><h3>{entry.title}</h3><Link to={`/clubs/${entry.club_id}`}>{entry.club_name}</Link></div>
                </div>
                {entry.member_since && <p className="mx-muted">Club member since {new Date(entry.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>}
                {squads.length > 0 && <p><strong>Current squads:</strong> {squads.map(squad => squad.name).join(' · ')}</p>}
                {entry.biography && <p className="mx-prose">{entry.biography}</p>}
                {entry.qualifications && <div><h3>Qualifications</h3><p className="mx-prose">{entry.qualifications}</p></div>}
            </article>;
        })}
    </section>;
}

function RefereeingCareer({ id, own, careerEditor = true }: { id: number; own: boolean; careerEditor?: boolean }) {
    const { data: referee, error, reload } = useCareer<Referee>(`/referees/${id}`);
    const [editing, setEditing] = useState(false);
    const [adding, setAdding] = useState(false);
    const { run, busy, feedback } = useAction(reload);
    if (error) return <section className="mx-panel"><h2>Refereeing career</h2><p role="alert">{error}</p><button onClick={reload}>Retry</button></section>;
    if (referee === undefined) return <p role="status">Loading refereeing experience…</p>;
    if (!referee && !own) return null;
    return <section className="mx-stack" aria-label="Refereeing career">
        <div className="mx-panel">
            <div className="mx-card-top"><h2>Refereeing career</h2>{own && <button onClick={() => setEditing(value => !value)}>{editing ? 'Close editor' : referee ? 'Edit referee details' : 'Add referee details'}</button>}</div>
            {referee && <>
                {referee.biography && <p className="mx-prose">{referee.biography}</p>}
                <div className="mx-facts"><span>{referee.service_area}</span><span>{referee.languages}</span><span>{referee.formats.split(',').map(format => formats[format.trim()] || format).join(' · ')}</span></div>
                {referee.qualifications && <div className="mx-career-qualifications"><h3>Qualifications · self-reported</h3><p className="mx-prose">{referee.qualifications}</p></div>}
                <div className="mx-career-officiating"><span>{referee.accepts_paid ? `From ${referee.fee} ${referee.currency} / match` : 'Not accepting paid appointments'}</span><span>{referee.accepts_volunteer ? 'Open to volunteering' : 'Not accepting volunteer appointments'}</span></div>
                {own && <Link className="mx-button" to="/referees/me">Appointments & availability →</Link>}
            </>}
        </div>
        {own && editing && <ProfileEditor profile={referee ?? null} onSaved={() => { setEditing(false); reload(); }} />}
        {referee && <>
            {feedback}
            <CareerTimeline profile={referee} onRemove={own && !busy ? entryId => void run(() => remove(`/referees/me/career/${entryId}`), 'Entry removed') : undefined} />
            {own && careerEditor && <button className="mx-career-add" onClick={() => setAdding(value => !value)}>{adding ? 'Cancel' : 'Add career, qualification or volunteering'}</button>}
            {own && careerEditor && adding && <CareerForm reload={() => { setAdding(false); reload(); }} />}
            <MatchHistory profile={referee} />
        </>}
    </section>;
}
