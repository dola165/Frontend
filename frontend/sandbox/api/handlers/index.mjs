// Registers every synthetic API domain. Order matters only for overlapping patterns.
// Squad join links first (squad-page.mjs), then pages: a club created as a page answers ahead of the newcomer and club domains (see pages.mjs).
import './access.mjs';
// My squads, step 3: the personas' squads and the step's own endpoints, ahead of the squad and club domains.
import './my-squads.mjs';
import './campaign-management.mjs';
import './projects.mjs';
import './squad-page.mjs';
import './pages.mjs';
import './club-people.mjs';
import './auth.mjs';
// Families before newcomers: a person who signed up and added a child is answered as a parent.
import './family.mjs';
import './newcomer.mjs';
import './family-squads.mjs';
import './club-coach-schedule.mjs';
import './social.mjs';
import './club.mjs';
import './football.mjs';
import './store.mjs';
import './campaigns.mjs';
import './jobs.mjs';
import './nav-extra.mjs';
import './world-extra.mjs';
import './map-extra.mjs';
import './profile-extra.mjs';
import './matches-extra.mjs';
import './reservations.mjs';
