import { apiClient } from '../../../api/axiosConfig';
import type { SeriesScope, SquadEventPlan } from '../api';

export interface TrainingSelection { venueId: number; pitchId: number; contactName: string; contactPhone: string; note: string }
export interface RentalQuote { venueId: number; pitchId: number; venueName: string; pitchName: string; timezone: string; currency: string; totalPrice: number; status: 'PENDING' | 'CONFIRMED'; cancellationHours: number; available: boolean; issue?: string }
export interface BookingOccurrence { sessionId?: number; startsAt?: string; endsAt?: string; beforeStartsAt?: string; beforeEndsAt?: string; bookingStatus?: string; bookingStartsAt?: string; bookingEndsAt?: string; bookingTimezone?: string; oldTotalPrice?: number; oldCurrency?: string; bookingConsequence?: string; cancellationDeadline?: string; quote?: RentalQuote; available?: boolean; issue?: string }
export interface BookingPreview { occurrences: BookingOccurrence[]; quoteToken: string; canCommit: boolean; unavailableOccurrences?: number; eventCount?: number; affectedResponses?: number; responsePolicy?: string; paymentPolicy: string; seriesPolicy?: string }
export interface BookingContext { revision: number; startsAt: string; endsAt: string; timezone: string; series: boolean; linked: boolean; canCoordinate: boolean; bookingStatus?: string; canCancelBooking?: boolean }
export interface BookingChange { requestId: string; revision: number; scope: SeriesScope; action: 'RESCHEDULE' | 'CANCEL'; startsAt?: string; endsAt?: string; reason: string; quoteToken?: string }
export const selectionSignature = (plan: SquadEventPlan, selection: TrainingSelection) => JSON.stringify({ plan, selection });
const root = (squad: number) => `/squad-communication/${squad}/training-bookings`;
export const previewTraining = async (squad: number, plan: SquadEventPlan, selection: TrainingSelection, signal?: AbortSignal) => (await apiClient.post<BookingPreview>(`${root(squad)}/preview`, { plan, ...selection }, { signal })).data;
export const createTraining = async (squad: number, plan: SquadEventPlan, selection: TrainingSelection, quoteToken: string) => (await apiClient.post(root(squad), { plan, ...selection, quoteToken })).data;
export const bookingContext = async (squad: number, session: number, signal?: AbortSignal) => (await apiClient.get<BookingContext>(`${root(squad)}/${session}`, { signal })).data;
export const previewBookingChange = async (squad: number, session: number, change: BookingChange) => (await apiClient.post<BookingPreview>(`${root(squad)}/${session}/preview`, change)).data;
export const saveBookingChange = async (squad: number, session: number, change: BookingChange) => (await apiClient.post(`${root(squad)}/${session}`, change)).data;
