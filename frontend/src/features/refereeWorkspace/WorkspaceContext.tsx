import { createContext, useContext } from 'react';
import type { Appointment } from '../matchExchange/api';
export const RefereeWorkspaceContext = createContext<{
  openMatch: (eventId: number) => void;
  addAvailability: (appointment?: Appointment) => void;
} | null>(null);
export const useRefereeWorkspace = () => useContext(RefereeWorkspaceContext);
