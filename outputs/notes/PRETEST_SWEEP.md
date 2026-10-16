# Pre-test sweep: before the owner's colleagues test the new frontend

16 October 2026. The owner's colleagues will sit at the owner's PC and use the new frontend (:5178) themselves: World, the club page, page creation, registration and everything else built so far. The owner will watch where they get lost or where things don't work the way they expect. This sweep makes that version as good as possible.

## Your job, in your area

1. **Start from the newest sandbox.** Merge `claude/overhaul-sandbox` (at `80aa47c` or later) into your branch first: the owner's new phone navigation and two waves of fixes landed there today.
2. **Walk your area as a first-time colleague would**, without knowing the code:
   - **Main screen:** desktop **1920×1080**, since the test runs on the owner's PC.
   - **Then 390px phone.**
   - **Then Georgian** (the colleagues are Georgian).
   - Use fresh accounts where a journey starts from nothing (sign up a new person).
   - The sandbox personas are at `http://localhost:<your web port>/__mode/parent?to=/parent`, `/__mode/coach?to=/home`, `/__mode/member?…` and `/__mode/analyst?…`.
3. **Look for what makes a tester stop or frown:**
   - console errors or broken screens;
   - dead ends, meaning no obvious way forward or back;
   - buttons that do nothing or pretend;
   - English left in Georgian screens;
   - words a football person wouldn't use;
   - things that look different from the same thing elsewhere;
   - overflow or clipped text;
   - empty states that don't say what to do;
   - anything that contradicts the owner's decisions (`CLAUDE.md`, `ROUND_2.md` owner's notes, `PRODUCT_MODEL.md` §13: one club per person, verification unlocks rather than blocks, show don't tell, football words).
4. **Fix the small and medium ones directly,** one commit each.
   - **Don't change the design direction.** If something needs a redesign or an owner decision, write it down instead of building it.
   - **Don't touch Agent Dola** (a colleague of the owner owns it). Note only how it behaves.
5. **Stay in your area.** If the problem is in another chat's area, message that chat (ids on the board). For shared files, keep edits minimal and name them in your merge request.
6. **Send merge requests to the coordinator** (`local_be027ab5-df6f-4d50-b64e-cb21005db19a`) as you go, naming any sandbox API file you changed.

## Hand back

A short report:
- what you walked (journeys, both widths, both languages);
- what you fixed (commit ids);
- what's left for the owner, each item in one line saying why it needs them;
- anything a tester will hit that is deliberately fake or unfinished, so the owner can warn them (Dola's canned answers, simulated checkout, pretend verification, approximate street names).
