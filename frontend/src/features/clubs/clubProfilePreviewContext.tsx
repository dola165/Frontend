import { createContext, useContext } from 'react';
import { useSearchParams, type SetURLSearchParams } from 'react-router-dom';

export const ClubPreviewQueryContext = createContext<[URLSearchParams, SetURLSearchParams] | null>(null);
export const ClubPreviewActiveContext = createContext(true);

/** A panel owns its filters; the background page continues to own the browser URL. */
export function useClubProfileSearchParams(): [URLSearchParams, SetURLSearchParams] {
  const browser = useSearchParams();
  return useContext(ClubPreviewQueryContext) ?? browser;
}
