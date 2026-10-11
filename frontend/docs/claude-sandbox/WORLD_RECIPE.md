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
   - **Things you choose or follow are big cards:** a picture (crest, face or photo), the title, a quiet facts line, "belongs to", one bright fact, one main action for who is looking, and Follow and Open as quiet actions.
   - **Moments on the calendar are score lines:** the time, both crests, the score always in the last column, one quiet tag.
   - **Waiting items are a dot, the state in words, and an arrow.**
5. **Filters that make sense.**
   - At most three primary filters, each a pill that shows its value. Choices open in a small glass panel over the map, and everything else goes under More filters.
   - Delete the filters the context replaces.
6. **The World stage** (`stage/WorldStage.tsx`): every World page fills the same frame, so nothing jumps between tabs.
   - **The header row** (`StageHead`): title and short subtitle, the page's lists, the search, the filters, the actions.
   - **The map** (`useStageMap`): one map for all of World. The page only says which pins and pills it shows. The results on screen are its pins, one to one, and one search drives both. It folds to a strip, and the fold is remembered.
   - **The panel over the map** (`StagePanel`): the overview's field, or a list's "Browse area" (the count, the sort, and each result as one line from `source.line`).
   - **Places only:** people are counted at their club and never named on the map. A result placed at its club is a ring, and results without a place are counted.
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
