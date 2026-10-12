# The World page recipe

How a World page (the overview, a tab, a field) is built, so every page and every role gets the same care. It was learned on the coach overview and the tabs in October 2026.

1. **Who opens it.**
   - List the audiences: each kind of coach separately, then parent, player, referee, fan and the rest.
   - Write one line each: what they selfishly want here.
   - Build for that, from data the app already serves. Never invent results, counts, verification or distances.
2. **Context first.**
   - "For" (a parent's child, a coach's squads) and "Near" (the area, or Anywhere) come from the World bar.
   - A page never has its own City field or "Searching for" chip.
3. **The likely answer, pre-chosen.**
   - Each role opens on its likely answer: a parent at the child's age, a coach at their squads.
   - It is written once, as ordinary chips that can be removed.
   - A link's own filters always win.
   - Anything the data cannot answer yet goes to "Before release" in `ROUND_2.md`.
4. **The right shape.**
   - **Under the map, the tab's filters across the page, then one column the width of the Home feed** (`directory/ListSplit.tsx`, 680px, left of centre) with the feed's sizes: 14px names, 12px and 11px lines, quiet greys. A result's name goes to its full page; a press elsewhere on it, or its details button, shows it beside the list, the list sliding to the left edge.
   - **What shows beside the list is more than a card, less than the page**: the thing's top (cover, crest or face, facts, the one action), links to the parts of its page that have something in them (`PaneTabs`), then a little of each part with "View …" to that tab (`PaneSection`). What it relates to opens over it with a way back (`useRelatedOpen`).
   - **Things are rows, one to a line** (`layout: 'rows'`, `directory/ResultRow.tsx`, `ListRow` for the few plain ones) in one panel: a crest, face or small photo, the name as the link and one mark after it, at most two quiet lines (what, where and how far, one bright fact), a status as a dot and a word or a number worth seeing (a price), and one action, quiet when every row has one. Clubs, venues, tournaments, jobs, trials, places to train.
   - **People are football cards, several to a line** (`layout: 'tiles'`, `directory/ResultTile.tsx`): their mark in the corner (`corner` marks), their club's crest opposite, the face, the name, what they do, club and distance, what they are open to, a price and one action at the foot; one colour per kind of people; never ratings or numbers.
   - **Moments on the calendar are score lines:** the time, both crests, the score always in the last column, one quiet tag.
   - **Waiting items are a dot, the state in words, and an arrow.**
5. **Filters that make sense.**
   - At most three primary filters, each a pill that shows its value. Choices open in a small glass panel over the map, and everything else goes under More filters.
   - Delete the filters the context replaces.
6. **The World stage** (`stage/WorldStage.tsx`): every World page fills the same frame, so nothing jumps between tabs.
   - **The header row** (`StageHead`): title and short subtitle, the page's lists, the search, the filters, the actions.
   - **The map** (`useStageMap`): one map for all of World. The page only says which pins and pills it shows. The results on screen are its pins, one to one, and one search drives both. It folds to a strip, and the fold is remembered.
   - **Under the map** (`BelowMapHead`): what is under the map starts with its name, symbol, count and options over a line, so the map and the page never run into each other.
   - **The panel over the map** (`StagePanel`): the overview's field, or a list's "Browse area" (the count, the sort, and each result as one line from `source.line`).
   - **Choosing a result:** every `line()` returns its `action` ("Open club"), and a `place()` whose pin is something else (a person's club) names its own. Lines are buttons that choose; only the chosen line offers its action. The choice lives in the address (`selected`); the map flies only when a line is pressed or a link arrives with a choice.
   - **Places only:** people are counted at their club and never named on the map. A result placed at its club is a ring, and results without a place are counted.
   - **Nearest first** (`area: 'nearest'`): lists of people are ordered by distance from the World area and never narrowed to a city; `area: true` narrows (clubs).
   - **Groups** (`source.groups`): results that belong together are shown under one header in the Browse area and below the map (a chosen match's referee bench); a header with a pin chooses it. Single results gather in one last group.
   - **The pane and the drawers** (`peek/`, `peek=kind-id`, `side=kind-id`; the kinds in `peek/kinds.ts`, each a body in `peek/PeekBody.tsx`): a thing pressed in the list under the map opens beside the list (`PeekPane`), with who is behind it stacked over it and "‹" back; pressed anywhere else (the map's panel, a docked strip, a shared link, a narrow screen) it comes out as a drawer from the right, who is behind it from the left, the page dimmed between them. Where it opens is decided at the press (`PeekPlaceContext`). A thing with parts (a club) shows them as tabs inside it (`usePeekPart`, `part=` in the address), never as links away; its full page opens at the tab shown. Close, Back or Escape closes it; the full page is one click (or a modifier click) away.
   - **Making things** (`compose/`): one "+" per tab (`CreateMenu`, its `face` the tab's likely action) offering only what real permissions allow (`createActions.ts`), with drafts to continue first. A form is a thing the frame shows (`peek=arrange-…`, `ArrangePeek`), opened where the person is (`useArrangeLink`: beside the list, else the drawer; a plain link outside World), its draft in session storage and never in the address, its receipt the thing it created (`peek=match-…`). One-decision steps belong inside the thing's own frame.
   - **Score lines** (`layout: 'scores'`, `directory/ScoreResults.tsx` on `scoreboard/`): moments on the calendar sit in group cards, stacked one per line in the column. A group can stay when empty (`always`) and say what it holds (`describe`). A match's state comes from one place (`scoreboard/matchState.ts`), never from a row.
   - **Where a list is** (`nav` filters: a day, a period): kept in the address like a filter, but without a pill, never counted or cleared; changing tab drops it.
   - **Over the map** (`source.Top` through `StageTop`): a page's own control floating on the map (the day strip), rendered inside the page so it keeps its context. `heading` and `HeadTools` give the heading under the map its words and controls (‹ ›).
   - **The Browse area by place** (`panel: 'pin'` or a function): the panel groups by where (each ground a pin) while the list groups by when and what, so they never repeat each other; `where` names the group and gives the pin's chip (a time or a score).
   - **The away line** (`source.away`): the chosen result's line from your own ground, straight and labelled "≈ 10 km", only when both ends are known.
   - **Match codes** (`scoreboard/matchCode.ts`): one code per match (`x12` an arranged match, `s34` a club fixture, `t5.67` a tournament fixture) is the list key, `selected=` and the drawer id; built from the source and its id, never from the row's own id.
   - **Quiet refresh:** `refreshMs` reloads a list that changes by itself (today's matches); `notifyWorldChanged` reloads lists after something is done in a drawer.
   - **The dock** (`StageDock`): a strip of the person's own work docked on the map (the Dugout), above the results on phones.
   - **Tabs:** each list has a symbol and a count before filters (`source.icon`, `source.count`), and opens for who is looking (`opening`).
7. **Honest states.**
   - Loading looks like the result.
   - An empty state names what was searched and offers one way to widen it.
   - An unknown total is "12+".
   - A proposed or missing score is never a result.
8. **Privacy.**
   - No one under 18 is listed or pinned.
   - A child's name shows only to their own parent.
   - Cards carry no personal contact details.
   - Sponsored links are labelled and never paid placement.
9. **Looks.** 13px, quiet greys, one bright thing per row, football words, crests and faces. No stat tiles, no rainbows of pills, no coloured side lines.
10. **Done means:**
    - the state is in the address;
    - focused tests pass;
    - a multi-agent review was run and its findings were checked and fixed;
    - the page was checked at 1920×1080 and 390px as coach@talanti.ge and as a parent (`gk-sandbox-family=1`);
    - `ROUND_2.md` is updated;
    - the owner said OK, then it was committed (never pushed).
