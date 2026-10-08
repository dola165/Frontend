import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
import { ArrowLeft, ArrowRight, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import './applicant.css';

export function AdmissionFrame({ title, description, children, back }: {title: string; description?: string; children: ReactNode; back?: string}) {
    const copy = useJourneyCopy();
    const location = useLocation();
    const { requestedPlayerId } = usePlayerSelection();
    const browsing = location.pathname === '/map';
    const requests = location.pathname === '/admissions';
    return <main className="admission-applicant">
        {back && <Link className="admission-back" to={playerPath(back, requestedPlayerId)}><ArrowLeft size={16}/>{copy('Back', 'უკან')}</Link>}
        <header className="admission-heading"><p className="admission-eyebrow">{copy('Your next football chapter', 'თქვენი შემდეგი საფეხბურთო ნაბიჯი')}</p><h1>{title}</h1>{description && <p>{description}</p>}
            <nav aria-label={copy('Joining football', 'ფეხბურთში მონაწილეობა')}>{browsing ? <span aria-current="page"><MapPin size={16}/>{copy('Find a group', 'ჯგუფის მოძებნა')}</span> : <Link to={playerPath('/map', requestedPlayerId)}><MapPin size={16}/>{copy('Find a group', 'ჯგუფის მოძებნა')}</Link>}{requests ? <span aria-current="page">{copy('My requests', 'ჩემი მოთხოვნები')}</span> : <Link to={playerPath('/admissions', requestedPlayerId)}>{copy('My requests', 'ჩემი მოთხოვნები')}<ArrowRight size={16}/></Link>}<Link to={playerPath('/parent', requestedPlayerId)}>{copy('Parent Hub', 'მშობლის სივრცე')}</Link></nav>
        </header>{children}
    </main>;
}
export function AdmissionLoading() {
    const copy = useJourneyCopy();
    return <p className="admission-loading" role="status"><Loader2 className="animate-spin" size={20}/>{copy('Loading joining arrangements…', 'მონაწილეობის პირობები იტვირთება…')}</p>;
}
export function AdmissionError({ message, retry }: {message: string; retry?: () => void}) {
    const copy = useJourneyCopy();
    return <div className="admission-error" role="alert"><p>{message}</p>{retry && <button className="admission-button" onClick={retry}><RefreshCw size={16}/>{copy('Try again', 'ხელახლა ცდა')}</button>}</div>;
}
