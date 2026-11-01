import { Wallet } from 'lucide-react';
import { Section } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type * as api from '../../squadCommunication/api';
import type { ChildClub } from '../api';
import { priceLabel } from './familyMoney';
import { FamilyMoneyHistory } from './FamilyMoneyHistory';
import './parent-hub.css';


/**
 * Money: for each squad, what the club charges (its published programme price, or "No fee set by the club") and, when
 * the club keeps it in its records, agreed dues, outside receipts, waivers and corrections. Nothing is ever invented.
 */
export function ChildMoney({ childId, clubs, squads, revision = 0 }: { childId: number; clubs: ChildClub[]; squads: api.SquadOverview[]; revision?: number }) {
    const copy = useJourneyCopy();
    return <Section boxed icon={Wallet} tone="warning" title={copy('Money', 'ფული')} className="ph-section ph-money" id="money">
        {clubs.map(club => {
            // Older servers send names only; then the squads the parent can open stand in, without a price.
            const rows = club.squads?.length ? club.squads : (club.squadNames.length ? club.squadNames : [club.clubName]).map((name, index) => ({ id: squads.find(s => s.name === name && s.club_id === club.clubId)?.id ?? -index - 1, name, price: undefined }));
            return <div key={club.clubId} className="ph-money__club">
                {clubs.length > 1 && <p className="ph-eyebrow">{club.clubName}</p>}
                <ul className="ph-rows">
                    {rows.map(row => {
                        const known = row.price !== undefined;
                        return <li key={row.id} className="ph-money__row">
                            <span className="ph-row__icon" aria-hidden="true">₾</span>
                            <span className="ph-row__text"><strong>{row.name}{known ? ` · ${priceLabel(row.price, copy)}` : ''}</strong>
                                <small>{!known ? copy('Ask the club about fees', 'ჰკითხეთ კლუბს საფასურზე') : ''}</small></span>
                        </li>;
                    })}
                </ul>
                <FamilyMoneyHistory club={club.clubId} child={childId} revision={revision} />
            </div>;
        })}
    </Section>;
}
