import { get, post, root } from '../api';
import type { AuthSessionId } from '../../../utils/authStorage';

export interface MoneyFact { id: number; type: 'RECEIPT' | 'WAIVER' | 'CORRECTION'; amount: string | number | null; currency: string; happenedOn: string; reference: string | null; reason: string; reverses: number | null; recordedAt: string }
export interface MoneyRecord {
    id: number; title: string; squadId: number | null; subjectUserId: number | null; dueOn: string | null; period: string | null; revision: number; canRecord: boolean; openingStatus?: string;
    balance: { agreed: string | number | null; received: string | number | null; waived: string | number | null; remaining: string | number | null; currency: string | null; status: string; reminderCandidate: boolean };
    history: MoneyFact[];
}
export interface MoneyCommand { type: MoneyFact['type']; revision: number; amount: string | null; happenedOn: string; reference: string | null; reason: string; reverses: number | null }
export const readMoney = (club: number, id: number, signal: AbortSignal) => get<MoneyRecord>(`${root(club)}/money/${id}`, signal);
export const readFamilyMoney = (club: number, child: number, signal: AbortSignal) => get<MoneyRecord[]>(`${root(club)}/family-money?child=${child}`, signal);
export const recordMoneyFact = (club: number, id: number, body: MoneyCommand, key: string, session: AuthSessionId) => post<MoneyRecord>(`${root(club)}/money/${id}/facts`, body, { 'Idempotency-Key': key }, session);
export const recoverMoneyFact = (club: number, id: number, key: string, session: AuthSessionId) => post<{ outcome: 'RECORDED' | 'NOT_RECORDED'; record: MoneyRecord }>(`${root(club)}/money/${id}/recovery/${key}`, {}, undefined, session);
/** Money is displayed as supplied by the decimal API; missing currency/amount never invents GEL or zero. */
export const moneyText = (value: string | number | null, currency: string | null) => value == null || !currency ? 'Amount not known' : `${value} ${currency}`;
