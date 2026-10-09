# Project agent instructions

## Development workflow

- Work directly in the current task with the user's selected Codex model and reasoning effort. Do not introduce model-selection machinery or force a different reasoning setting.
- Work without subagents by default. Use delegation only when the user explicitly asks for it; no standing request to delegate remains.
- Do not call Jev or any other external service to select development models, allocate work, or advise Codex orchestration. Application features using Jev/Dola have a separate scope and retain their existing credential and spending controls.
- Use ChatGPT subscription authentication for OpenAI development models. Do not add a separately billed generative API fallback or silently change models or billing.
- Preserve existing work and use focused verification. Keep required correctness, security, migration, backup and deployment checks; avoid redundant investigation and repeated checks without a concrete reason.
- Create separate user-visible tasks only when explicitly requested.

## UI layout rules — required for every product change

- Use Club workspace, the club profile and Matches & competitions as the established layout references. Inspect their current rendered UI before designing a related screen. Operational pages use a compact header, stable context navigation, and Overview first followed by the relevant tasks.
- Never render navigation collections as inline text or concatenate names into a paragraph. Every destination needs its own bounded flex/grid row, a readable label, visible spacing and a minimum 44px touch target. Long names must wrap deliberately or truncate with their full text available. Deduplicate destinations; keep long pickers internally scrollable.
- A component must import the CSS it needs. Shared navigation must not depend on a stylesheet loaded by another route. Scope feature styles beneath the feature root; generic names such as admission-panel must never restyle a different feature when navigation loads its CSS.
- No oversized marketing heroes, slogan eyebrows, walls of explanatory copy, or giant full-width buttons in work screens. Start with the task, its current state and a useful next action. Put detailed rules beside the action they affect; use specific tabs/disclosures for editing, agreements, history and advanced work.
- Keep tab selection in the URL, preserve account/player context and drafts, and retain the existing mutation, version, privacy and permission safeguards. A layout change must not invent counts, silently accept terms, discard a pending action, or reduce useful functionality.
- Embedded schedules and work panels must fit their container: show a compact summary with a clear full-workspace link rather than nesting another page’s complete navigation, calendar and inspector. Primary actions must reflect verified current status (for example, current club versus no club), with unknown/loading states kept distinct.
- Verify the actual rendered initial page and navigation back from related lazy routes, in light/dark themes and at desktop/390px widths. Check long/empty/populated content, keyboard focus, visible active navigation, overflow, and readable line lengths. Unit tests and a successful build do not replace visual inspection.
