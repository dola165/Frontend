 in progress: World fixes (wave 2) |  ||  ||  ||  || 95597a7 || 395d8a7 || 395d8a7 || 70db92d || 0d8bf58 || 092f07d || 2820c0c, cfc9be8 || 94015b5 || 70db92d || ID | One-line title | Lens | Owner chat (board Area) | Status | Commit last checked |
|---|---|---|---|---|---|
| F01 | A recovered page edit can overwrite a newer successful edit | reliability | Page creation (Fable) | fixed (011b01c, claude/creation-fixes-65ca8d; recovery.test.tsx) | e6a24ed7529f |
| F02 | A job draft survives into a different account | reliability | Store (Fable) | fixed (claude/store-fixes-ac69c7) | df80859 |
| F03 | A club job's Message action can open an unrelated person | reliability | Store (Fable) | fixed (claude/store-fixes-ac69c7) | 4dfba13 |
| F04 | Cancellation can succeed while the dialog says nothing happened | reliability | Club workspace and My squads (Fable) | fixed (workspace-fixes) | f210c14 |
| F05 | An admissions refresh can erase the explanation for a failed submission | reliability | Coordinator (planning, briefs, merges) — route shared/unassigned area | fixed (claude/squad-family-fee1ab) | 70db92d |
| F06 | Independent data failures can hide otherwise usable responsibility work | reliability | Club workspace and My squads (Fable) | fixed (My squads, Parent Hub child squads, Agent Hub) | e18df78, 81ce8f9, 90c12cf |
| F07 | The short page-creation flow does not yet reach a complete editable club page | simplicity | Page creation (Fable) | no longer true | e6a24ed7529f |
| F08 | New page contracts are ahead of the inspected real backend | integration | Page creation (Fable) | open | e6a24ed7529f |
| F09 | Job creation offers a response method that some roles cannot use | reliability | Store (Fable) | fixed (claude/store-fixes-ac69c7) | e0b9bea |
| F10 | Jobs has two discovery systems, and one map's pins do nothing | integration | Store (Fable) | fixed (claude/store-fixes-ac69c7) | addd5eb |
| F11 | Combined responsibilities overflow the intended navigation hierarchy | simplicity | Coordinator (planning, briefs, merges) — route shared/unassigned area | fixed (owner-chosen C variant; claude/shell-messages-f6698d) | 80aa47c |
| F12 | Finding a child's group still speaks the language of job posting | simplicity | World (Fable) | fixed (claude/world-fixes-57d425) | 2506bce |
| F13 | A tournament invitation changes into a fresh request on the full page | integration | World (Fable) | fixed (claude/world-fixes-57d425) | 1793828 |
| F14 | The post composer's Event detour loses unfinished writing | reliability | Home, club and user profiles | fixed (claude/shell-messages-f6698d) | f545f83 |
| F15 | Needs you can put colleagues' overdue work ahead of your own | simplicity | Club workspace and My squads (Fable) | fixed (workspace-fixes) | 1dc7737 |
| F16 | The fundraiser's default provider is not an established direct-payout path for a Georgian organizer | business | Store (Fable) | open: owner decision, in ROUND_2 Before release | b08a289 |
| F17 | Unknown club membership can silently change the publishing actor | reliability | Store (Fable) | deferred to hardening: ROUND_2 Before release | b08a289 |
| F18 | Global search's keyboard highlight is not exposed as an active result | reliability | Coordinator (planning, briefs, merges) — route shared/unassigned area | fixed (claude/shell-messages-f6698d) | 94015b5 |
| F19 | Communication indicators claim more than the available evidence | reliability | Coordinator (planning, briefs, merges) — route shared/unassigned area | fixed (Messages: shell; squad replies: squad-family; My squads: workspace) | 2820c0c, cfc9be8 |
| F20 | Dola needs recoverable availability and the active object, not only a broad role | integration | Coordinator (planning, briefs, merges) — route shared/unassigned area | fixed (claude/shell-messages-f6698d) | 092f07d |
| F21 | Compact labels remove identity where the context does not supply it | simplicity | Club workspace and My squads (Fable) | fixed (My squads: workspace cd6d1ce; tournaments: world-fixes) | cd6d1ce, cd33005 |
| F22 | First-run save failures advance while clearing their own explanation | reliability | World (Fable) | fixed (claude/world-fixes-57d425) | 60216ea |
| F23 | A failed booking response can discard the selected time before resolving the outcome | reliability | Coordinator (planning, briefs, merges) — route shared/unassigned area | changed | e6a24ed7529f |
| F24 | Contextual commands need consistent access without turning every screen into a toolbar | simplicity | Store (Fable); Club workspace and My squads (Fable); Page creation (Fable) — page-edit part resolved | changed: Store part fixed (fundraiser Manage 6ee22dd, storefront seller entry 8a40c21, claude/store-fixes-ac69c7); other areas as before | e6a24ed7529f, b5ddf9fe5747, becf3b7be9c6, 8a40c21 |
| F25 | A saved club record can be offered for creation again after refresh fails | reliability | Club workspace and My squads (Fable) | in ROUND_2 Before release | d0e1eaa |
| F26 | Retrying a failed fundraiser publication creates another draft | reliability | Store (Fable) | deferred to hardening: ROUND_2 Before release | b08a289 |
| F27 | The short fundraiser journey does not yet match the real local backend contract | integration | Store (Fable) | deferred to hardening: ROUND_2 Before release | b08a289 |
| F28 | Unreported fundraising progress is presented as zero raised | reliability | Store (Fable) | fixed (claude/store-fixes-ac69c7) | 744fce6 |
| F29 | Opening an existing activity can require understanding how it was created | simplicity | Club workspace and My squads (Fable) | fixed (My squads summary + calendar summary with direct Edit) | add11ab, 81ce8f9, 8d7d7f4 |
| F30 | Essential actions still switch to English after choosing Georgian | integration | Club workspace and My squads (Fable): parent replies; Home, club and user profiles: public club actions; Page creation (Fable): generated team names (fixed 1d0c852, claude/creation-fixes-65ca8d); Coordinator routes earlier shared items | fixed (parent replies + public club actions: squad-family; team names: creation-fixes) | 0d8bf58 |
| F31 | Switching store sellers requires manually clearing the earlier cart | simplicity | Store (Fable) | deferred to hardening: ROUND_2 Before release | b08a289 |
| F32 | Drifting store rows put hidden duplicate product links into keyboard navigation | reliability | Store (Fable) | fixed (claude/store-fixes-ac69c7) | 584e1c0 |
| F33 | Let a parent choose or add the child before repeating the group paperwork | simplicity | Coordinator (planning, briefs, merges) — route admissions; no explicit board Area owner | fixed (claude/squad-family-fee1ab) | 70db92d |
| F34 | Put the parent's next reply and football week ahead of repeated profile controls | simplicity | Coordinator (planning, briefs, merges) — route Parent Hub; Club workspace and My squads (Fable) owns the embedded squad schedule | fixed (claude/squad-family-fee1ab) | 395d8a7 |
| F35 | Open the ground picker with an actual nearby choice in view | simplicity | Page creation (Fable) | fixed (453409e, claude/creation-fixes-65ca8d) | e6a24ed7529f |
| F36 | Show the fundraiser's goal and giving action before its updates on a phone | simplicity | Store (Fable) | fixed (claude/store-fixes-ac69c7) | 29b8ff3 |
| F37 | New accounts borrow the demo coach's match context in the sandbox | integration | Coordinator (planning, briefs, merges) — route shared sandbox football API with World and Page creation | fixed (0076e17; verified end to end by Club creation fixes, 16 Oct) | e6a24ed7529f, becf3b7be9c6 |
| F38 | Give parents one place to see their child's own dues | simplicity | Coordinator (planning, briefs, merges) — route Parent Hub with Club workspace and My squads (Fable) for fees records | design built (squad-family); amount source is an open owner decision | 395d8a7 |

## Recheck notes — F01–F32

- **F01 — open:** Still true on newest Page branch. Actual browser: failed name A at version 1; successful name B at version 1; reload replays A with version 2 and overwrites B. The focused component reproduction also passes by asserting this bug.
- **F02 — open:** Draft key and account-unscoped restore unchanged; owner-branch difference is only page-creation entry copy. Retain prior two-account reproduction.
- **F03 — open:** Message still uses poster.id as a person chatWith id. Referenced JobDetail implementation unchanged.
- **F04 — open:** Still true. Actual phone retest: cancellation POST 200, separate announcement POST 502; dialog retains Keep it and does not refresh. Reload shows Cancelled. The literal Nothing was sent sentence is the fallback for an error without a server message, not every error.
- **F05 — open:** Admission failure followed by refresh can still replace the form. Prior sandbox POST404 is not evidence of a missing real endpoint. Shared admissions has no board Area owner; coordinator to route.
- **F06 — open:** All-or-nothing independent request groups and missing partial-error presentation unchanged. Do not repeat specialist exploration; retain prior isolated evidence.
- **F07 — no longer true:** No longer true: newest App imports features/clubs/profile/ClubProfilePage, wraps it in PageEditProvider, uses PagePanels and direct contact/fees/grounds edit links. Public projection issues are already in owner retest, not a new finding.
- **F08 — open:** Known integration: page API family is still ahead of the inspected backend; do not count missing endpoints as new defects. New isPageView guard safely preserves legacy pages when endpoint is absent.
- **F09 — open:** IN_APP still offered for categories whose application form only supports COACH/PLAYER; no functional change on newest Store branch.
- **F10 — open:** Jobs map callback still does nothing; World and dedicated Jobs retain separate filters/sources. World source checked on World branch as well as combined, not solely Store branch.
- **F11 — open:** Combined-coach/parent navigation construction unchanged. Baseline is an observed role combination, not a demand to restore My Work.
- **F12 — fixed (2506bce, world-fixes):** Places to train is headed "Training groups for <child>" with the children as faces beside it; Post a job only on jobs; groups get Joining football. Before: Still true for the heading: child-specific Training groups are under Jobs & volunteering, including in Georgian. The newer Page branch changes the creation button to generic Create; do not retain the old universal claim that every version says Post a job.
- **F13 — fixed (1793828, world-fixes):** the full page enters through entryGate and the pane's steps (TournamentEntry), so it continues the invitation. Before: Invitation preview and full-page actions still diverge. Known Before release item; no new finding.
- **F14 — open:** Event detour still leaves local composer state behind. Latest Home functional source is unchanged; missing Home commit affects CSS only.
- **F15 — open:** Needs-you prioritisation unchanged. This is a simplicity proposal about attention, not an access-control defect.
- **F16 — open:** Official GoFundMe supported-country list checked again: Georgia is absent from direct payout countries. A supported-country organizer can raise for someone elsewhere and transfer funds outside GoFundMe with a disclosed plan; do not describe all Georgian beneficiaries as prohibited.
- **F17 — open:** Membership unknown/failure still collapses to no club and can silently select PERSON; Store changes only page creation links.
- **F18 — open:** Active keyboard result remains visual/data-attribute only; referenced source unchanged. Source-based accessibility limitation, no screen-reader certification.
- **F19 — open:** Direct online indicator and acknowledgement/read distinctions unchanged. Coach source checked on workspace branch, shared messages on newer page branch; not evidence that private messages were actually read.
- **F20 — open:** Availability retry/context omissions unchanged. Canned sandbox model response is not a production model evaluation. Shared area unassigned on board.
- **F21 — fixed (My squads cd6d1ce; tournaments cd33005, world-fixes):** Matchday, match dialog and .ics say "Senior team (Club)" where a squad name is shared. Before: Context-poor club/team labels unchanged. Preserve compactness; add just the missing identifying fact.
- **F22 — fixed (60216ea, world-fixes):** a lasting "Not saved: … Try again" note; follows settled one by one and retried only where they failed. Before: saveAndGo catch sets a note then go clears it on newest World and page-creation branch. Page additions save skipped town but do not fix failure receipt. Best-effort progression is intentional; report the lost explanation.
- **F23 — changed:** Scope changed: venues and stadium renting removed for now. Retain historical defect evidence but exclude from active round-3 priorities; do not claim fixed.
- **F24 — changed:** Changed: contact, fees, grounds and involved edits now open page edit panels directly; club store already has Add. Retain narrower questions about global seller entry and fundraiser-owner management; do not route solved page edits back to workspace.
- **F25 — open:** Still true. Actual browser: create 201, refresh GET 502, same new-record form offered again; retry creates a second record. Two Review ball bag links visible. Receipt preserved in recovery-receipts.json.
- **F26 — open:** Still true. Actual browser: draft 90012 created, publish 502; retry creates draft 90013 and publishes it. First draft remains. Current Store source retains the same two-call retry mechanism.
- **F27 — open:** Known integration: existing backend field/length/media contracts still differ. No new missing-endpoint finding. The 600 vs 240 character contract and goal/use-of-funds condition remain specific frontend contract risks.
- **F28 — open:** Null reported progress still rendered as zero raised/zero percent. Source unchanged; distinguish missing information from actual zero.
- **F29 — open:** Calendar-only match still opens edit wizard while exchange match opens details. Proposed compact summary with direct actions; intentional Edit must remain direct.
- **F30 — changed:** Known localization finding, expanded with NEW parent-first evidence: Georgian Parent Hub asks for a reply, but SessionAvailability Coming/Can’t come and SquadMessages Mark as read remain English; public club first-visit/Join actions and automatically generated U10 Mixed/U14 Boys names also remain English after Georgian entrances. No old specialist, store, World or travel leaks counted again. Proper names and user-written fixture content are not translation defects. See new phone screenshots and exact new sources.
- **F31 — open:** Single seller/currency protection unchanged. Proposal is preserving separate baskets, not adding combined cross-seller checkout.
- **F32 — open:** aria-hidden drifting clone rows still contain keyboard-focusable links. Coarse-pointer/reduced-motion uses ScrollRow already; retain keyboard-specific finding.

## Store, jobs and fundraising fixes (16 October, branch claude/store-fixes-ac69c7)

- **Fixed:** F36 29b8ff3 (phone: goal and Give after the title), F03 4dfba13 (club job → club contact tab with the role), F09 e0b9bea (Apply in the app only for a club's coaching roles), F10 addd5eb (pins open listings, column narrows, World link keeps filters, map defaults to jobs), F28 744fce6 (Not reported yet), F32 584e1c0 (inert drift copies, focus pauses), F02 df80859 (drafts per person and club).
- **F24, Store part (wave 2):** 6ee22dd fundraiser Manage row on the fundraiser page and the club catalogue's cards (Report progress, Post an update; Edit, Pause/Resume, End), tools at /campaigns/:id/manage/report|update|edit on the manager's operations, returning to where they were opened; 8a40c21 a quiet Add a product on /store for someone who runs a club's store, opening the club store's add form.
- **Written into ROUND_2 "Before release"** (b08a289): F17, F26, F27, F31 (proposal) and F16 (open owner decision; "Ask the club how to give" kept).

## Round 3 additions

- **F33 — open:** verified in stock sandbox, EN and KA; submission itself blocked by known sandbox endpoint. Lead with child choice or the inline name/date fields when there is no child. Keep time, ground and costs visible in a short summary; fold the full terms and show the relevant consent at the commitment it governs. Reuse the club page's squad-prefilled first-visit enquiry where that is the intention.
- **F34 — open:** verified with explicit enrolled-family fixture, not a completed stock admission. Keep the child switcher, compress the selected child's identity into one line, then show the next session/reply and the latest coach update. Put edit, membership and family settings beneath those. Smaller alternative: move the existing next-action card above the duplicate identity panel.
- **F35 — open:** verified on newest page branch in EN and KA. Fit the initial map to a few nearest pitches, or offer the nearest named grounds independently of the first bounds until the owner pans. Preserve the map and the option to add an unlisted pitch.
- **F36 — open:** verified signed out at 390×844; no donation or external checkout attempted. Put a compact organiser/goal/give block near the title on phones, with the story and updates following. Smaller alternative: move just the progress and donation action before Updates. Keep who handles the money and the club-reported amount distinction beside it.
- **F37 — open:** verified sandbox-only; no production permission conclusion. Make the synthetic match endpoints honor the same viewer and newly created clubs as page creation, with a no-squads fan case. Verify new-owner → friendly → result and fan-only browsing before judging those experiences complete.
- **F38 — open:** proposed; no personal bill was seeded and no incorrect balance is claimed. Put a small per-child Fees line by their club: amount recorded as due, due date and statement/contact action; if unknown say Not recorded, never zero. Start with the club's recorded statement rather than adding a checkout or a new main tab.

## Headline freshness

All ten headline items **still true**, newest owner source checked at 2026-10-15T22:48:47.463892+00:00. [Exact commits and paths](<C:/Users/daddo/.codex/visualizations/2026/10/15/01a140b7-0fd4-75d1-83e6-acb031d9ec3f/grasskickz-product-review/round-3/top-ten-recheck.json>). No application changes.

Coordinator update 2026-10-16T02:03Z: statuses above reflect claude/integration at 311de1b (wave 1 complete). Wave 2 in progress: World fixes (F12, F13, F21 tournaments, F22), Store fixes (F24 remainder), Workspace fixes (F06 Agent Hub), Shell & messages (F14, Android strip).

Coordinator update: wave 2 complete on claude/integration 79b7add (F06 Agent Hub, F12, F13, F14, F21 tournaments, F22, F24 store part merged; build passes). Open: F11 (owner pick), F16 and F38 (owner decisions); hardening items in ROUND_2 Before release.
