# Club creation retest (15 October 2026)

Tested on the Page creation chat's server (:5179, branch `claude/page-creation-834687` at `e6a24ed`) as a brand-new account registered in Rustavi, at 1440×900, then checked at phone width (375). Players, staff invites and anything that needs the backend were ignored, as asked. Screenshots 00–15 are beside this file. Before: `../club-creation-before/REVIEW.md`.

## Result

**It works now.** A new person goes from Home to a live club page without leaving the page and without a workspace.

| | Before (14 Oct) | Now |
|---|---|---|
| Can a new account create a club? | No (blocked by the "verified adult" rule) | Yes |
| Taps from Home to live | impossible | 29 as I did it; **about 8 at minimum** (card, Club, name, Create, ground ×3, Go live) |
| Typed characters | — | 14 for the name; 27 in total with phone and time |
| Ends in | the workspace | the live page, with a share card and QR code |

Seven of those 29 taps were caused by bugs: fixing the town, re-entering lost contact details, a time field that wouldn't take a time.

What already works well:
- the Home card;
- the start sheet;
- town chips;
- the generated crest and the crest designer;
- the map of nearby pitches with surface and size;
- the inline fee sliders;
- the one-tap email suggestion;
- the Go live share card with a QR code and a pre-written first post.

## What breaks the flow (fix first)

1. **What you fill in is not what visitors see.** After Done:
   - Contact shows "Not published yet." although phone and email were saved;
   - Fees show "Ask the club about fees." although 40–80 GEL was saved;
   - the teams are not shown;
   - the first post from the share card appears nowhere (not on the page, not in the feed).

   The edit view and the visitor view read different data. The owner sees their work vanish the moment they press Done.
2. **Unsaved edits are lost silently.** I typed a phone and picked the email, then tapped another box: the contact box went back to empty, with no warning and nothing saved. Autosave has to save every field as you type, or at least on leaving the box.
3. **The town ignores registration.** Registered in Rustavi, but the start sheet said Tbilisi. Two extra taps, and most people won't notice.
4. **The automatic crest doesn't count.** A crest is generated, yet "Go live" still asks for one until you open the designer and press Keep. Whatever we generate should count as done.
5. **The suggested sentence is only a placeholder.** "Football for everyone in Rustavi" is grey hint text. Press Done without typing and the page has no line at all, and the step stays undone. A suggestion should be filled in, and accepted by doing nothing.
6. **Fees default to 40–80 GEL.** One tap on Done publishes a price the owner never chose. That is invented data. Start empty ("Free" or "How much?"), or show "Most clubs in Rustavi: 40–80" as a chip to tap.

## What can be simpler

7. **The landing does five things at once.** A walkthrough bubble (4 steps), the 8-step list dropped open, an example page (a picture of Dinamo's page in the middle column), ghost boxes on both sides, and "Add a box" chips. Show **one thing: the next step**, big. Drop the tour. Keep the list closed. Put the example behind its link only; inside the page it reads as "is that my page?".
8. **Hide the match and workspace buttons until they mean something.** Open challenge, Arrange a match and Open workspace show on a draft page with nothing in it. On a phone, "Open workspace" is the biggest, greenest button on the screen.
9. **The phone needs its own edit mode.** At 375px the first screen is the header, three buttons and the setup box; nothing to fill in is visible without scrolling past the tabs. On a phone, setup should be **one full-screen card per step** (like stories), and the page appears at the end. The cover photo is also missing at phone width.
10. **Ages as a 45-button grid.** Ask "Boys, girls or both?" first, then one row of ages. Better still for Georgia: **birth years** (2012, 2013, 2014 …). Grassroots groups are named and run by birth year, and parents know the year, not "U11".
11. **Training time uses the browser's time box.** Typing 18:00 left it empty (it can expect AM/PM). Use time chips (16:00 · 17:00 · 18:00 · 19:00 · 20:00) and "Same days for U12?" after the first team.
12. **Training times don't become sessions.** "Coming up" still says "Nothing planned in the next 30 days" after setting Tue · Thu 18:00. The calendar should fill itself from the teams.
13. **"About" is a form in a pop-up with two text boxes** (one line + about). Make it one sentence, written for them, edited right where it shows (the dashed "Say what you are" line in the header).
14. **Empty boxes shown to visitors.** Club store / jobs / fundraising with "No products published yet". Hide a box from visitors until it has something.
15. **Small things:**
    - the four type tiles are radios with no names for screen readers;
    - the phone shows raw (599123456, not +995 599 12 34 56);
    - the post composer keeps the old red crest after choosing a blue one;
    - the phone/tablet Home still says Stadiums · Campaigns · Roles and has no "Start your club" card;
    - the first-run screens still don't appear after sign-up.

## Bigger ideas, including outside our rules

- **A. Talk to create (Agent Dola, in Georgian, voice).** "I run Rustavi Eagles, two groups, born 2014 and 2016, Tuesdays and Thursdays at six at the community pitches, 50 lari." Dola fills the whole page and shows it; the owner taps Go live. For people who don't read or type well, speaking is the simplest possible form. Dola already exists and acts through the same actions.
- **B. Claim instead of create.** Pre-load every Georgian club (federation and public lists, with town and pitch). Most owners then never create: they find their club, tap "That's us", and confirm what's already there. Creation becomes confirmation.
- **C. Start from the pitch.** First question: "Where do you train?" (tap the pitch on the map). That gives the town, the location, nearby clubs (for the duplicate check) and a likely name ("… Rustavi"). Then the name, then done.
- **D. Live by default.** No draft decision: once there's a name and a ground, the page is live with "You can change anything". A draft only for people who ask for one. One less decision, and nothing forgotten in draft.
- **E. Three steps, not eight. Let the page fill itself from use.** Setup asks only name, ground and ages. Everything else arrives from what they do: the first training appears in Coming up, the first result in Results, the first photo in the gallery, the first parent's question in Messages. The page grows by itself.
- **F. "Let someone set it up for me."** Most of these owners have a nephew, an assistant coach or a parent who can use a phone. Send them a link; they fill the page; the owner taps "Looks right". Realistic in Georgia, and the owner still owns it.
- **G. Copy from Facebook.** Paste the club's Facebook page link to bring in name, logo, cover, phone and address. Many Georgian clubs already have one. Check what Meta's terms allow before building it.
- **H. Create by WhatsApp.** Message a GrassKickZ WhatsApp number ("New club") and answer five questions in the chat; the page link comes back. For this audience, WhatsApp is the app they already use. A larger project (WhatsApp Business API), but the strongest "simpler than Facebook" story.
