---
name: grasskickz-product-review
description: "Investigate GrassKickZ's evolving sandbox frontend to uncover hidden user friction, missing opportunities, and obstacles to completion. Use for broad product, UX, design, and architecture reviews guided by radical simplicity, including recovery of useful ideas from the current frontend. Produces evidence-backed recommendations; does not implement application changes. Ordinary fixes and release checks use their own workflows."
---

# GrassKickZ Product Review

Help the owner finish the new GrassKickZ frontend by discovering problems and opportunities they have not already identified. Review the product as something people must understand and use, then trace the engineering decisions that help or obstruct that experience. Deliver recommendations that make the next development decisions easier.

## Product intent

The owner wants people to use GrassKickZ with almost no learning, memory, or organizational knowledge. Judge effort through recognition, decisions, navigation, repeated input, waiting, uncertainty, and recovery, as well as clicks. Compactness and professional presentation should improve comprehension and a distinctive, easily communicated brand.

The sandbox is the intended future frontend. The current frontend contains useful ideas, mature behavior, and lessons; it is evidence, not an automatic feature specification. Neither version is presumed superior. The sandbox is early and actively changing: the owner estimated only 20-60% complete on 15 October 2026. Treat that as historical context, not a measured completion score.

Owner-supplied direction to verify against current intent and implementation:

- Ordinary users have three main navigation tabs; people with additional responsibilities may have a fourth. Evaluate whether the destinations and actions are understandable, rather than optimizing a tab count mechanically.
- GrassKickZ World brings the map and directories together as a discovery destination. Examine whether this consolidation actually helps people find and act on things.
- Store, jobs, and fundraisers should be simpler to understand and use.
- My Squads presents club involvement through a person's own responsibilities. Essential club actions should also be accessible as individual commands in relevant contexts. A coach should not need a separate management journey to make a simple edit.
- Actions such as adding a store item, editing contact details, or arranging a match should be available where the intention arises. Contextual access should not flood every screen with controls.
- Reels, ads, streaming, and Dola's assistance/browser automation illustrate future growth. Consider their implications across the foundations without allowing one example to dominate the review or assuming unbuilt features already have settled requirements.

These are starting points. Discover additional product areas, user intentions, and constraints from the actual application. New owner instructions take precedence.

## Scope and execution

Default to investigation and recommendations. Do not change application code, configuration, dependencies, data, branches, or deployments. Keep evidence, checkpoints, and report artifacts in a permitted output location. A later implementation request needs its own scoped workflow; invoking this review skill does not authorize fixes.

Use the user's selected model, reasoning effort, and subscription authentication. Work in the current chat without subagents unless the user explicitly requests delegation. Do not add external model services or separately billed generative fallbacks. Discover and use available tools and relevant skills when they materially improve evidence; do not require a particular connector to perform ordinary local inspection.

Starting paths on the owner's Windows workstation:

- Sandbox: `C:\Users\daddo\Projects\Frontend-claude-sandbox`
- Current frontend: `C:\Users\daddo\WebstormProjects\Frontend`
- Related backend, when a finding needs contract evidence: `C:\Users\daddo\IdeaProjects\GrassKickZ`

Verify the paths, repository instructions, and actual checkouts. On another host, locate the corresponding projects instead of assuming Windows paths exist. Read relevant backend contracts only when they clarify frontend behavior, feasibility, or an important constraint. Do not turn the assignment into unrelated backend cleanup.

Record local date/time, branch, commit when available, and whether uncommitted changes are present. Local evidence does not establish upstream freshness. Preserve concurrent work: never switch, reset, stash, clean, or lock the owner's checkout for a review. Associate findings with the files/revisions observed; recheck affected evidence if it changes during the investigation.

## Investigation loop

### Establish breadth before choosing depth

Read [references/review-lenses.md](references/review-lenses.md) at the start of a whole-product review, and consult the applicable lenses during investigation. It is a coverage aid, not a fixed list of product requirements.

Discover the whole first-party surface from routes, navigation, menus, dialogs, forms, role gates, components, hooks, stores, API clients, configuration, tests, and product documentation. Include hidden or indirectly reachable workflows. Distinguish visible UI, working behavior, mock data, dormant code, and stated future intent. Inventory dependencies and generated assets without treating vendored/generated output as authored product logic.

Maintain a coverage ledger by product area and user intention, connected to the relevant files and cross-cutting concerns. Track roles/responsibilities, entry points, contexts, important states, evidence collected, remaining questions, and next investigation. Distinguish inventoried, source-inspected, runtime-observed, inferred, blocked, and inapplicable coverage. A file listing does not establish behavior coverage.

Every substantial area discovered needs an explicit disposition. Do not spend the whole review polishing conclusions about navigation, World, or the owner's named examples while leaving other areas unexamined. When a new journey exposes another area, add it to the ledger.

### Follow real intentions through complete journeys

For each substantial area, understand what people are trying to accomplish, their starting context, the choices imposed on them, the resulting state, and how they know it worked. Trace the actual source responsible for the behavior, including relevant state and contracts. Read complete relevant implementations across modules; do not infer a whole flow from a filename, search match, or isolated component.

Where a permitted local environment is available, inspect rendered behavior and exercise representative journeys with isolated test data. Match the scenario to the claim: include mobile/touch, keyboard, role differences, or recovery states where relevant. Use authorized test environments for actions that mutate data. Builds and existing focused checks can establish specific technical facts; they do not substitute for observing usability. Avoid blanket installation or test campaigns without a concrete question.

If runtime access is unavailable, continue source-based discovery, document the limitation precisely, and keep UI/performance claims conditional. Do not repair the application just to make a review scenario run. A blocked journey should not stop independent areas from being investigated.

Use the current frontend and relevant documentation to recover overlooked ideas and understand established behavior. Ask what value each older behavior supplies, whether the new product still needs it, and how that value could be delivered more simply. Also identify old patterns worth leaving behind. Do not require one-to-one screen or feature parity.

Consult focused Git history or design records when they can explain a consequential decision. Separate documented intent from a plausible reconstruction; do not claim to know why an earlier approach failed without evidence.

### Discover beyond reported problems

Actively search for friction the owner has not named. Examine transitions between features and responsibilities, repeated decisions, duplicate input, stale context, unclear ownership, inaccessible actions, misleading success states, lost work, and gaps between what a screen promises and what actually happens.

For each important flow, consider whether the user could avoid a decision, have context inferred transparently, edit in place, reuse information, reach the action directly, or recover more easily. Explore several plausible simplifications before recommending structural changes. Sometimes the useful recommendation is removing a step, improving wording, preserving a strong existing interaction, or deferring an abstraction.

Treat fewer tabs, fewer clicks, smaller components, more memoization, and more automation as hypotheses, not quality scores. Compact layouts can conceal information; direct actions can increase accidental changes; inferred defaults can be wrong. Retain meaningful consent, permission, privacy, and transaction safeguards where the actual workflow requires them.

Evaluate new opportunities against observed needs and the owner's direction. Clearly label proposed ideas, source-based deductions, and verified defects. An absent early-stage feature is not automatically a defect or urgent work. Do not invent an implementation, user preference, or causal history to make a recommendation sound certain.

### Challenge and refine conclusions

Before finalizing an important finding, check its underlying source/context, look for counterexamples or another entry point, and consider whether the behavior is intentional or already being addressed. Ask what would make the proposed change harmful or unnecessary, and whether a smaller alternative gives the same benefit.

When alternatives are difficult to judge in prose, develop concrete flow sketches, diagrams, or small isolated mockups/experiments using available capabilities. Keep them separate from application source and use them to answer a specific decision. A prototype demonstrates an alternative, not production integration or user validation.

Conduct a second, deliberately skeptical pass over both the recommendations and coverage ledger. Revisit neglected domains and connections across areas. Check whether simplifying one area shifts effort elsewhere, removes useful capability, or creates future coupling. This is self-review; do not describe it as independent validation.

Use further investigation to resolve material uncertainty, uncover another area, or improve a recommendation. The owner explicitly prefers depth over economy and accepts modest marginal improvements. Do not stop at an economical first pass. Avoid padding, invented findings, and repeating settled checks solely to consume usage.

## Evidence and recommendations

For each material finding, preserve enough information to act on it:

- User intention, affected people/context, and current behavior.
- Evidence with exact observed paths and useful line references, or reproducible runtime steps/screenshots; identify which version supplied it.
- The source of difficulty and its practical consequence. Separate product friction from implementation difficulty and explain their relationship when established.
- A concrete improvement, the expected user benefit, material tradeoffs, and a simpler alternative where useful.
- Status: observed defect, observed friction, source-based risk, unfinished capability, proposed opportunity, or unresolved intent. Include confidence and what would change the conclusion.
- Suggested timing, dependencies, and a way to check whether the improvement worked. Do not invent precise effort, performance gains, conversion effects, completion percentages, or numerical scores.

Ground material technical and visual claims in appropriate evidence. A source comparison cannot prove faster rendering or a stronger brand. Brand assessments should explain clarity, consistency, distinctiveness, and communication using actual screens/content, while labeling judgment and untested audience hypotheses.

Prioritize by impact on important intentions, breadth of affected use, repeated effort, risk, and dependencies. Distinguish completing missing journeys, repairing a harmful foundation, optional polish, and later opportunities. Include strengths to preserve and explicit reasons to defer work. Architectural advice must serve a concrete present need or plausible growth constraint, with its complexity cost explained.

## Sustained work and delivery

During a long investigation, maintain durable checkpoints outside application source: observed revisions, coverage, findings, open questions, decisions, and the next useful action. Resume from those records after a context boundary. Refresh changed evidence selectively rather than restarting. Keep user updates concise and focused on discoveries and remaining uncertainty.

There is no minimum runtime or arbitrary number of findings. Continue while useful coverage or evidence work remains. At an actual context, access, or usage boundary, preserve progress and state the remaining work honestly; do not claim automatic continuation beyond the host's capabilities or declare a partial review complete.

Choose the delivery medium for the user's current needs. Without a requested format, provide a readable entry point and persistent, navigable findings/coverage artifacts for a large review. Do not require HTML, a dashboard, a comparison table, or an aesthetic report project at the expense of investigation. Include code excerpts only when they explain a finding; never dump the codebase as a substitute for analysis.

The final result should make it easy to find:

- What most obstructs finishing the sandbox and the next useful development sequence.
- Useful discoveries beyond the owner's initial examples, with evidence and practical improvements.
- Recommendations across the actual product, including valuable current-frontend ideas to preserve, adapt, or deliberately leave behind.
- How simplification, compact professional presentation, branding, accessibility, reliability, and future growth interact.
- What is verified, inferred, proposed, intentionally unfinished, changing, or still unknown.
- Coverage and limitations, including areas inspected with no material finding. Do not force criticism into every area.

Finish only after checking the inventory against the coverage ledger, investigating substantial uncovered areas that remain accessible, challenging consequential recommendations, and validating artifact links and evidence references. If required evidence remains unavailable, deliver the useful result with explicit gaps and next verification steps; describe its coverage accurately.
