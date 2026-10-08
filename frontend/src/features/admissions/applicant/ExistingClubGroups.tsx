import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchClubJoiningOptions } from '../../joining-contract/api';
import { playerPath } from '../../parents/playerSelection';
import { AdmissionError, AdmissionLoading } from './AdmissionFrame';
import { useAdmissionData } from './useAdmissionData';
import { useAdmissionCopy } from './copy';

/** Real club squads remain approachable before the club publishes enrollment terms. */
export function ExistingClubGroups({clubId, playerId}: {clubId: number; playerId?: number}) {
    const {copy} = useAdmissionCopy();
    const groups = useAdmissionData(useCallback(signal => fetchClubJoiningOptions(clubId, signal), [clubId]));
    const options = groups.data?.options.filter(option => !option.opportunity) ?? [];
    if (groups.loading) return <AdmissionLoading/>;
    if (groups.error) return <AdmissionError message={groups.error} retry={groups.refresh}/>;
    if (!options.length) return null;
    return <section className="admission-panel"><h2>{copy('Ask about an existing club group', 'ჰკითხეთ კლუბის არსებულ ჯგუფზე')}</h2><p>{copy('The club can advise on suitability and arrange a first visit. Availability, fees and regular placement will be agreed with you.', 'კლუბი ჯგუფის შესაბამისობაზე გირჩევთ და პირველ ვიზიტს შეათანხმებს. ადგილები, გადასახადი და მუდმივი მონაწილეობა თქვენთან შეთანხმდება.')}</p>
        <div className="admission-grid">{options.map(option => <article className="admission-card" key={`${option.squadId??"programme"}:${option.programmeIds.join(",")}:${option.squadName}`}><h3>{option.squadName}</h3><span className="admission-badge">{option.availability === 'CLOSED' ? copy('Currently unavailable', 'ამჟამად მიუწვდომელია') : option.availability === 'WAITLIST' ? copy('Waiting list', 'მოლოდინის სია') : copy('Ask the club', 'ჰკითხეთ კლუბს')}</span><Link className="admission-button" to={playerPath(`/admissions/organizations/${groups.data!.organizationId}/inquire${option.squadId?`?squad=${option.squadId}`:option.programmeIds.length?`?programme=${option.programmeIds[0]}`:""}`,playerId)}>{copy('Ask about this group', 'ჯგუფზე კითხვა')}</Link></article>)}</div>
    </section>;
}
