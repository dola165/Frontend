# Club creation review: before (14 October 2026)

Persona: owner of a small grassroots club (2–3 squads, a few staff, everything in WhatsApp and on paper, low patience, low reading). Run on :5178, the combined sandbox with every chat's work, at 1920×1080. A new account was registered (Rustavi), then the club page was checked as Dinamo's owner, because a new account cannot get past step 1 (see below).

## Verdict

**Today a small owner cannot create a club, and could not run it from the club page if they did.**

- Creating it is blocked for a new account, and nothing explains how to get unblocked.
- The setup asks for things this person doesn't have (organisation type, category, website, a CSV file), and skips what they do have: a crest, a ground, some kids.
- Afterwards, every job (info, ground, fees, staff, squads, players) leaves the club page for the workspace or a separate page.
- Their page would stay empty, so yes: as it stands, they wasted their time.

## 1. Finding "create a club"

| What | Today |
|---|---|
| Home | No link. The left rail has Joining football, My Schedule, Following, Followed clubs. |
| Top bar | No My Club tab for someone without a club, and so no "Start your club" there either. |
| World | **+ Create → Places → Create a club**, filed beside "List your venue" (venues were supposed to be removed). The same menu offers "Arrange a match" to someone with no club. |
| Account page | "Create a club or organization", only when the account is allowed. |

## 2. The setup (`/organizations/create?kind=CLUB`, three steps)

**Blocker.** A new account sees "Creation requires a verified adult account with completed account setup. Check your account details before continuing." **Continue** is disabled, nothing says what to verify or where, and World offers "Create a club" to the same account. The sandbox has no create endpoint either, so nobody can finish this flow here.

| Step | What it asks | Problem for this owner |
|---|---|---|
| 1. Type and activities | 8 organisation types (Company, Sponsor, Media, Healthcare…), 9 club categories, "Organize tournaments" and "Manage a venue and its bookings" checkboxes | System words, choices they can't answer, two paragraphs of rules about accounts and "saved in this browser tab". |
| 2. Profile details | Name, About, Website, Public email, Public phone, Address, **What we do** (a second About), map location hidden in a fold, **Fill details from Excel or CSV** | No crest, no ground, no age groups or squads, no fees. Two free-text boxes for the same thing. |
| 3. Review | A summary, "Create organization", "It does not mark the organization or your qualifications as verified." | Reads like a contract. |
| Done | **Open workspace** (main button), View profile, **Import squads or venues**, Create another organization | Sends them straight into the workspace, which is the part they will never use. |

## 3. After creation: the jobs, from the club page (as Dinamo's owner)

| Job | Where it happens | Stays on the page? |
|---|---|---|
| Name, about, crest | Cover has "Change cover". Contact's Edit opens workspace → Settings → Profile. No crest edit on the page. | No |
| Contact | Edit → workspace Settings → Profile | No |
| Training fees | Edit → workspace Programmes | No |
| Ground / facilities | Edit → workspace Facilities | No |
| Squads | Teams & training → "Edit programmes" → workspace. No "Add a squad". | No |
| Staff | Coaches & staff → "Manage staff" → workspace staff team; invites pick from people already in the club | No |
| Players | Teams → squad → "Players" → separate Squads page → **Add players** (only people already in the club) or **Create a player card**, one child at a time (7 fields with a live preview, which is good). Bulk only through a CSV import in the workspace. | No |
| Store, jobs, fundraising, sponsors | Edit → workspace / profile settings | No |

7 of 7 jobs leave the page. Nothing lets parents fill in their own child, which is the only way a club like this gets 40 kids into an app.

## 4. Is the page worth it?

- **For visitors: yes.** Dinamo's page is good: contact, fees, facilities, posts, store, staff, squads.
- **For a new small club: no, not yet.** It starts with no crest, no squads, no posts and no players. Every way to fill it goes through the workspace, and nothing on the page says what's missing or offers to add it.

## 5. Smaller faults seen on the way

- `/register` is a 404 (the page is `/signup`).
- The first-run screens (where you are, what to see, clubs to follow) never appeared after sign-up; it went straight to Home.
- World says "Near: Tbilisi" for an account registered in Rustavi.
- The World map showed no streets (blank dark map).
- The squad page says "See the squad**Players**, positions…" (missing space).
- The staff list repeats squads: "U14 & U16 Boys · U14 Boys & U16 Boys", and one coach shows six squads joined with "&".

## 6. What "after" should look like (for discussion)

1. **"Start your club"** on Home and in the top bar for anyone without a club.
2. **Anyone can start an unverified club.** The badge comes later. No account checks up front.
3. **One screen:**
   - name and town (already filled in);
   - crest photo;
   - the ground, as a pin on the map;
   - **which kids?**, as age tiles (U8 … U16), which create the squads.

   Then land on **the club page**, not the workspace.
4. **An owner checklist on the club page:** crest, ground, a coach, players, fees, first post. Each one opens a small sheet right there and disappears when done.
5. **Players by sharing a link:** send one join link to the WhatsApp group, and each parent fills in their own child. Pasting a list of names, or a photo of the paper list, is the fallback.
6. **Staff by phone number or a WhatsApp link,** with no account needed first.
7. **Empty states that show** what a full page looks like, not text explaining it.

Screenshots: `01-signup.jpg`, `02-home-after-signup.jpg`. The rest could not be captured because the app window was minimised; the steps above were read from the live pages and the code.
