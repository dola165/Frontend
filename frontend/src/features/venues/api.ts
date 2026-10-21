import { apiClient } from "../../api/axiosConfig";

export const formats = {
  "5_A_SIDE": "5-a-side",
  "7_A_SIDE": "7-a-side",
  "9_A_SIDE": "9-a-side",
  "11_A_SIDE": "11-a-side",
  FUTSAL: "Futsal",
  OTHER: "Other",
} as const;
export const surfaces = {
  ARTIFICIAL_GRASS: "Artificial grass",
  NATURAL_GRASS: "Natural grass",
  HARD_COURT: "Hard court",
  INDOOR: "Indoor",
} as const;
export interface Pitch {
  id: number;
  photoUrl?: string | null;
  revision: number;
  name: string;
  format: keyof typeof formats;
  surface: keyof typeof surfaces;
  covered: boolean;
  pricePerHour: number;
  active: boolean;
  resourceGroup: string;
  resourceUnits: string[];
}
export interface Venue {
  organizations?: { id: number; displayName: string; clubId: number | null; logoUrl: string | null; relationships: ('OWNS' | 'OPERATES')[]; declared: boolean }[];
  contentClassification?: string;
  contentRevision?: number;
  promotionBlocked?: boolean;
  capabilities?: import('../organizations/activities/api').OrganizationCapabilities;
  id: number;
  revision: number;
  displayName: string;
  description: string;
  city: string;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  publicPhone: string;
  publicEmail: string;
  website: string;
  bookingMode: "REQUEST" | "INSTANT";
  published: boolean;
  cancellationHours: number;
  minBookingMinutes: number;
  maxBookingMinutes: number;
  slotMinutes: number;
  amenities: string[];
  logoUrl?: string | null;
  photos: { url: string; caption: string }[];
  openingHours: { dayOfWeek: number; opensAt: string; closesAt: string }[];
  pitches: Pitch[];
  canManage: boolean;
  verificationStatus: string;
}
export type VenueDraft = Omit<
  Venue,
  "id" | "pitches" | "canManage" | "verificationStatus" | "capabilities" | "contentClassification" | "contentRevision" | "promotionBlocked" | "organizations"
>;
export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
  price: number;
}
export interface Availability {
  venueId: number;
  timezone: string;
  fromDate: string;
  toDate: string;
  days: {
    date: string;
    pitches: {
      pitchId: number;
      slots: Slot[];
      blocks: {
        startsAt: string;
        endsAt: string;
        status: string;
        kind: string;
      }[];
    }[];
  }[];
}
export type BookingStatus =
  "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type BookingKind = "RENTAL" | "MANUAL" | "ACADEMY" | "CLOSURE";
export interface Booking {
  id: number;
  venueId: number;
  venueName: string;
  venueAddress?: string;
  venuePhone?: string;
  timezone?: string;
  cancellationDeadline?: string;
  pitchId: number;
  pitchName: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  kind: BookingKind;
  totalPrice: number;
  currency: string;
  contactName: string;
  contactPhone: string;
  note: string;
  expiresAt: string | null;
  seriesId: string | null;
  canCancel: boolean;
}
export interface BookingHistory {
  content: Booking[];
  pageCursor: string;
  nextCursor: string | null;
}
export interface BookingHistoryQuery {
  cursor?: string;
  size?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}
export const fetchBookingHistory = async (params: BookingHistoryQuery = {}, signal?: AbortSignal) =>
  (await apiClient.get<BookingHistory>("/venues/bookings/mine/history", { params, signal })).data;

export interface BookingDraft {
  pitchId: number;
  startsAt: string;
  endsAt: string;
  contactName: string;
  contactPhone: string;
  note?: string;
  kind?: BookingKind;
  repeatWeeks?: number;
  expectedTotalPrice?: number;
  currency?: string;
  requestId?: string;
}
export interface VenueSearch {
  q?: string;
  city?: string;
  surface?: string;
  format?: string;
  covered?: boolean;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  date?: string;
  durationMinutes?: number;
  page?: number;
  size?: number;
}
// Older deployed venue responses predate activity capabilities. Preserve their
// existing canManage contract without enabling newer organization workflows.
export function normalizeVenueCapabilities(venue: Venue): Venue {
  if (Object.prototype.hasOwnProperty.call(venue, 'capabilities')) return venue;
  const canManage = venue.canManage === true;
  return {
    ...venue,
    capabilities: {
      enabledActivities: ['PROFILE', 'VENUE'], revision: 0, venueAvailable: true,
      canEditProfile: canManage, canConfigureVenue: canManage,
      canManageVenueBookings: canManage, canConfigureActivities: false,
      canCreateTournament: false, canInviteVenueOperator: false,
    },
  };
}
export const fetchVenues = async (params: VenueSearch, signal?: AbortSignal) => {
  const response = await apiClient.get<{
    content: Venue[]; totalElements: number; totalPages: number;
  }>('/venues', { params, signal });
  return { ...response.data, content: response.data.content.map(normalizeVenueCapabilities) };
};
export const fetchVenue = async (id: number, signal?: AbortSignal) =>
  normalizeVenueCapabilities((await apiClient.get<Venue>(`/venues/${id}`, { signal })).data);
export const saveVenue = async (id: number, draft: VenueDraft) =>
  normalizeVenueCapabilities((await apiClient.put<Venue>(`/venues/${id}`, draft)).data);
export const savePitch = async (
  id: number,
  pitch: Omit<Pitch, 'id'> & { id?: number },
) => normalizeVenueCapabilities((await apiClient.put<Venue>(`/venues/${id}/pitches`, pitch)).data);
export const fetchAvailability = async (
  id: number,
  date: string,
  durationMinutes: number,
  days = 7,
  signal?: AbortSignal,
) =>
  (
    await apiClient.get<Availability>(`/venues/${id}/availability`, {
      params: { date, days, durationMinutes },
      signal,
    })
  ).data;
export const createBooking = async (id: number, draft: BookingDraft) =>
  (await apiClient.post<Booking[]>(`/venues/${id}/bookings`, draft)).data;
export const fetchMyBookings = async (signal?: AbortSignal) =>
  (await apiClient.get<Booking[]>("/venues/bookings/mine", { signal })).data;
export const fetchVenueBookings = async (
  id: number,
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  (
    await apiClient.get<Booking[]>(`/venues/${id}/bookings`, {
      params: { from, to },
      signal,
    })
  ).data;
export const updateBooking = async (
  venueId: number,
  bookingId: number,
  action: "ACCEPT" | "DECLINE" | "CANCEL",
) =>
  (
    await apiClient.patch<Booking>(`/venues/${venueId}/bookings/${bookingId}`, {
      action,
    })
  ).data;
export const uploadVenuePhoto = async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return (
    await apiClient.post<{ url: string }>("/media/upload", body, {
      params: { context: "banner" },
    })
  ).data.url;
};
