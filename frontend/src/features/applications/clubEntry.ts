import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';

export type EntryIntent = 'JOIN' | 'ADDITIONAL_RESPONSIBILITY' | 'OPEN_TRIAL';
export interface EntryDecision {
  allowed: boolean; reason: string | null; message: string | null;
  pendingApplicationId: number | null; pendingInvitationId: number | null; eligibleFrom: string | null;
}

/** A result belongs to this exact account, club, role, intent and refresh. */
export function useClubEntryEligibility(clubId: number, role: 'PLAYER' | 'COACH', intent: EntryIntent, enabled: boolean, jobId?: number) {
  const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([sessionId, clubId, role, intent, jobId, enabled, revision]);
  const [result, setResult] = useState<{ key: string; data?: EntryDecision; error?: boolean }>({ key: '' });
  const reload = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    if (!enabled || !clubId) return;
    const controller = new AbortController();
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: controller.signal, params: { role, intent, jobId } };
    void apiClient.get<EntryDecision>(`/clubs/${clubId}/applications/eligibility`, config)
      .then(response => { if (!controller.signal.aborted) setResult({ key, data: response.data }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, error: true }); });
    window.addEventListener('focus', reload);
    return () => { controller.abort(); window.removeEventListener('focus', reload); };
  }, [clubId, role, intent, jobId, enabled, sessionId, key, reload]);
  const current = result.key === key ? result : undefined;
  return { data: current?.data, error: !!current?.error, loading: enabled && !current,
    allowed: enabled && !!current?.data?.allowed, sessionId, reload };
}

const reasons: Record<string, [string, string]> = {
  ALREADY_CONNECTED: ['You are already connected to this club. Request another responsibility from Account.', 'თქვენ უკვე დაკავშირებული ხართ ამ კლუბთან. დამატებითი პასუხისმგებლობა მოითხოვეთ ანგარიშიდან.'],
  ALREADY_PLAYER: ['You already have a playing relationship with this club.', 'თქვენ უკვე გაქვთ მოთამაშის კავშირი ამ კლუბთან.'],
  RELATIONSHIP_REQUIRED: ['Choose a club you currently belong to.', 'აირჩიეთ კლუბი, რომელთანაც ამჟამად ხართ დაკავშირებული.'],
  PENDING_APPLICATION: ['Review your existing application before sending another request.', 'ახალი მოთხოვნის გაგზავნამდე გადახედეთ არსებულ განაცხადს.'],
  PENDING_INVITATION: ['Review your current club invitation first.', 'ჯერ გადახედეთ კლუბის არსებულ მოწვევას.'],
  IDENTITY_REQUIRED: ['Add the relevant player or coach identity to your football profile first.', 'ჯერ დაამატეთ მოთამაშის ან მწვრთნელის შესაბამისი როლი თქვენს საფეხბურთო პროფილში.'],
  ACCOUNT_UNAVAILABLE: ['An active, verified football account is required.', 'საჭიროა აქტიური, ელფოსტით დადასტურებული საფეხბურთო ანგარიში.'],
  CLUB_UNAVAILABLE: ['This club is not currently accepting requests.', 'კლუბი ამჟამად მოთხოვნებს არ იღებს.'],
  INVITE_ONLY: ['This club accepts players by invitation only.', 'კლუბი მოთამაშეებს მხოლოდ მოწვევით იღებს.'],
  APPLICATION_REQUIRED: ['Send a player application for club review instead.', 'კლუბის განსახილველად გაგზავნეთ მოთამაშის განაცხადი.'],
  JOB_CLOSED: ['This role is no longer accepting applications.', 'ამ პოზიციაზე განაცხადების მიღება დასრულებულია.'],
  CONTACT_ONLY: ['Use this opportunity’s contact details to speak with the club.', 'კლუბთან დასაკავშირებლად გამოიყენეთ განცხადებაში მითითებული საკონტაქტო ინფორმაცია.'],
  ROLE_MISMATCH: ['Select the football identity required by this role.', 'აირჩიეთ ამ პოზიციის შესაბამისი საფეხბურთო როლი.'],
  COOLDOWN: ['You can apply again after', 'განმეორებითი განაცხადის თარიღია'],
};

export function useEntryCopy() {
  const { i18n } = useTranslation();
  const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
  const copy = (en: string, ka: string) => georgian ? ka : en;
  const reason = (decision: EntryDecision) => {
    const pair = reasons[decision.reason ?? ''];
    const message = pair ? pair[georgian ? 1 : 0] : copy('This action is unavailable. Review your account and requests.', 'მოქმედება მიუწვდომელია. გადახედეთ ანგარიშსა და მოთხოვნებს.');
    return decision.reason === 'COOLDOWN' && decision.eligibleFrom ? `${message} ${decision.eligibleFrom}.` : message;
  };
  return { copy, reason };
}
