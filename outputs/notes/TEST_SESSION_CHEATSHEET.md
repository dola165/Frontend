# Colleague test session: cheat sheet

The app: **http://localhost:5178** on this PC. It runs on demo data: nothing is real, and nothing reaches the live app.

## Who you are

The demo signs you in as **coach Luka Gelashvili** (FC Dinamo Tbilisi Academy).

| To be… | Open |
|---|---|
| **Coach Luka** (owner of Dinamo, coaches U14 and U16) | http://localhost:5178/__mode/coach?to=/home |
| **Luka as a parent** (children Saba and Nino; Parent Hub appears) | http://localhost:5178/__mode/parent?to=/parent |
| **A plain club member** (no tools) | http://localhost:5178/__mode/member?to=/clubs/1/workspace |
| **A performance analyst** (a few tools) | http://localhost:5178/__mode/analyst?to=/clubs/1/workspace |
| **A brand-new person** | Profile picture → Sign out → **Create account** (any email; the town matters). Adding a child makes them a parent. |
| **A visitor** | Sign out and browse |

**One persona at a time:** the switch is remembered for the whole browser, so switching in one tab switches every tab.

To get Luka back after a new account: sign out, then sign in with **coach@talanti.ge** and any password.

## Starting fresh

Restarting the demo API resets all data (new clubs, posts, replies). In the Terminal panel, open the **"sandbox API 4305"** tab, press **Ctrl+C**, then press the up arrow and Enter to run the same command again. Do this between testers.

## Good things to ask testers to try (goals, not instructions)

- **New to GrassKickZ:** "Create an account, then create your club and get it ready for parents to see."
- **Visitor:** "Find a club for a 9-year-old near you and work out what it costs and when they train."
- **Parent:** "Check when your son trains next and tell the coach he's coming." / "Find a group for your daughter and ask to join."
- **Coach:** "Tell your U14 parents Saturday's session moved, and see who has read it." / "Arrange a friendly for Saturday."
- **Anyone:** "Buy a training top from Dinamo's store." / "Find a volunteering job." / "Look at a fundraiser and give."

Watch where they hesitate, go back, or ask "where is…?". Note the screen and what they expected.

## Things that are deliberately not real yet (warn testers)

- **Agent Dola** gives canned answers, and its confirm cards don't appear. A colleague is rebuilding it.
- **Checkout** is a simulation: no money moves.
- **Club verification** is pretend. **Street names** for grounds are approximate.
- **Invite and join links** work inside the demo but send nothing to real phones.
- Some text in **Georgian** is new and not yet read by a native speaker. Clumsy wording is useful feedback.

## If something breaks

Reload the page. If it still breaks, restart the API (above) and note what happened.
