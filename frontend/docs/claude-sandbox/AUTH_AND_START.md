# Sign-in, basic permissions and the new user's start

A self-contained task for one session, done in one go. The owner and another session keep perfecting other pages in parallel, so stay inside this scope. Read the repository `CLAUDE.md`, `ROUND_2.md` and `PRODUCT_MODEL.md` (section 13, the 13 and 14 October decisions) first.

## Why

Registration asks people to choose a role, and much of the app still decides what to show from that account role. Both are wrong for the product: one person is often a coach, a parent and a player at once, and a self-chosen role says nothing about which squad or child someone may touch. A new user should be in, and looking at football near them, within a minute.

## 1. Sign-in (authentication)

- Registration asks only for name, phone or email, password, date of birth and town. No role picker (`RegisterPage`, `AccountRoleSelector`).
- Date of birth stays: under-age accounts keep the existing guardian and consent path (`ConsentPage`).
- Town is filled in from the device when the person allows it; otherwise picked from a short list.
- Sign-in stays as simple: one screen, honest errors, the existing session handling and OAuth redirect kept working.
- The backend still expects a `role` at registration. Until it is optional, send a neutral value and add "make role optional at registration" to "Before release" in `ROUND_2.md`. Keep the real request and response shapes.

## 2. Basic permissions (authorization)

- What a person may open and do comes from links someone else confirms: club staff, a squad's coach, a guardian linked to a child. In the frontend these arrive as `navigationCapabilities`. They never come from the account role or from what someone writes about themselves.
- Replace UI decisions based on the account role (`user.role`, roughly 120 checks; start with `App.tsx`, `LeftSidebar.tsx`, `OnboardingPage.tsx`, `MyClubPage.tsx`, `authRedirect.ts`, `NotificationsPage.tsx`, `ClubOverviewTab.tsx`) with capabilities. Where the backend has no capability yet, keep the behaviour and list it under "Before release".
- Basic level only: signed-out, signed-in, and the confirmed links above. Admin stays as it is.
- Route guards and loading states stay honest: unknown or loading is never shown as "no access".

## 3. The new user's start

- After registration, a first run of three screens at most. Every screen can be skipped, and the likely answer is already chosen:
  1. **Where are you?** The town is already filled in.
  2. **What do you want to see?** Picture tiles, several allowed: local clubs, youth and academies, matches and results, tournaments, women's football, jobs and volunteering, kit.
  3. **Follow a few clubs.** The nearest crests, with the obvious ones ticked.
  - Optional, and asked once: **What do you do in football?** Play, coach, parent or just watch. It only sets starting pins and hubs, never permissions. It can be changed later from the person's own profile.
- Getting a role later is easy and happens where it is needed. For example, arranging a match asks "You need a club: create one or ask to join." Asking to join a club or linking a child creates the confirmed link.
- Home is never empty for a new user.

## 4. The feed foundation

- Every post carries three facts:
  - **Topic:** result, tournament, training, store, and so on.
  - **Place:** where it happens.
  - **Reach:** who it is for. Reach is set by the kind of post, not by the poster. A registration for an Estonian tournament reaches eligible clubs in that region; a Dinamo Tbilisi tournament reaches its followers and fans nearby.
- Ranking, in order:
  1. People and clubs the person is linked to (squad, club, child).
  2. Who they follow.
  3. Posts near them on topics they chose.
  4. National highlights.
  5. Posts from far away only if followed or popular.
- Each post has "Why am I seeing this?" and "Show less like this".
- Record what people see, open, hide and follow. A learning algorithm comes later and trains on this record.
- Ranking belongs to the server. In the sandbox, fake it in `sandbox/api/handlers/social.mjs` using the real response shape. List the backend parameters under "Before release".

## Rules

- Follow the sandbox working style in `CLAUDE.md`: real API shapes, state in the URL, the visual language (compact, show don't tell), English and Georgian copy.
- Delete what you replace: the role picker, role-based branches, old onboarding steps.
- Check every screen in the browser at 1920×1080 and at 390px width, light and dark. Run `npm run check` once at the end.
- Commit each piece the owner accepts. Never push.

## Done when

- A new person registers without choosing a role and lands on a Home with local content within a minute.
- No screen decides access from the account role; coach, parent and staff areas appear only through confirmed links.
- The feed follows the ranking above in the sandbox, and "Before release" lists every backend change needed.

## Built (13 October 2026)

Done in one go on branch `claude/auth-and-start-c6307a`. What a new person sees, which role checks remain and the backend list are in the session's report; the decisions taken while building are in `PRODUCT_MODEL.md` ("Taken while building the start") and the remaining work under "Before release" in `ROUND_2.md`. The sandbox now lets anyone register (`sandbox/README.md`, "New accounts").
