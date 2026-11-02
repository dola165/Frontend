import { apiClient } from '../../../api/axiosConfig';
import type { AuthSessionRequestConfig } from '../../../api/axiosConfig';
import type { OrganizationProfile } from '../domain';

export interface Publication { published: boolean; revision: string; verificationStatus: string }
export const getPresence = async (id: number, signal: AbortSignal) => {
  // Capture the decision token before the details the person reviews. An intervening edit then
  // conflicts on save, rather than pairing an older profile with a newer token from a parallel read.
  const publication = await apiClient.get<Publication>(`/organizations/${id}/publication`, { signal });
  if (typeof publication.data?.published !== 'boolean' || typeof publication.data.revision !== 'string' || !publication.data.revision || typeof publication.data.verificationStatus !== 'string') throw new Error('Organization public profile not found.');
  const profile = await apiClient.get<OrganizationProfile>(`/organizations/${id}`, { signal });
  if (profile.data.id !== id || profile.data.clubId !== null) throw new Error('Organization public profile not found.');
  return { profile: profile.data, publication: publication.data };
};
export const changePublication = (id: number, before: Publication, published: boolean, sessionId: string | null) => {
  const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
  return apiClient.put<Publication>(`/organizations/${id}/publication`, { expectedRevision: before.revision, published }, config).then(r => r.data);
};
