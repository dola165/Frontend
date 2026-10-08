import { HttpHandler } from 'msw';
import { authHandlers } from './auth';
import { userHandlers } from './users';
import { clubHandlers } from './clubs';
import { feedHandlers } from './feed';
import { scheduleHandlers } from './schedule';
import { tournamentHandlers } from './tournaments';
import { tournamentSeriesHandlers } from './tournamentSeries';
import { tournamentRefereeHandlers } from './tournamentReferees';
import { volunteerHandlers } from './volunteers';
import { notificationHandlers } from './notifications';
import { mediaHandlers } from './media';
import { adminHandlers } from './admin';
import { organizationHandlers } from './organizations';
import { tryoutHandlers, tryoutAdminHandlers } from './tryouts';
import { mapHandlers } from './map';
import { chatHandlers } from './chat';
import { agentHandlers } from './agents';
import { storeHandlers } from './store';
import { parentHandlers } from './parents';

export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...userHandlers,
  ...clubHandlers,
  ...feedHandlers,
  ...scheduleHandlers,
  ...tournamentHandlers,
  ...tournamentSeriesHandlers,
  ...tournamentRefereeHandlers,
  ...volunteerHandlers,
  ...notificationHandlers,
  ...mediaHandlers,
  ...adminHandlers,
  ...organizationHandlers,
  ...tryoutHandlers,
  ...tryoutAdminHandlers,
  ...mapHandlers,
  ...chatHandlers,
  ...agentHandlers,
  ...storeHandlers,
  ...parentHandlers,
];
