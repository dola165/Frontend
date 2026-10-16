# Whole-product discovery lenses

Use these lenses to expose blind spots in the discovered product. Map applicable lenses to actual areas in the coverage ledger. Mark inapplicable or inaccessible areas with a reason. Extend the list when the implementation reveals something new; these examples neither define the feature backlog nor require speculative functionality.

## Recognition, context, and responsibility

| Lens | Questions that can reveal hidden effort |
| --- | --- |
| First encounter and return | Can a new person understand the product's value and take a useful action? Can a returning person resume unfinished work or recognize what changed without reconstructing their context? |
| Navigation and discovery | Do names and destinations match intentions? Where do people land from search, notifications, shared links, and browser history? Can they understand and leave a deep-linked screen? Does World combine discovery without concealing useful filters or results? |
| Responsibilities and scope | Does the person know which club, squad, individual, or identity an action affects? What happens with multiple squads, clubs, children, or responsibilities, where supported? Are legitimate actions absent because a coarse role check differs from the actual permission? |
| Direct contextual actions | Can people act beside the relevant information? Is the action discoverable outside a management workspace? Can different entry points share correct behavior and context without duplicating business rules? |
| Interaction consistency | Are the same intentions named and handled consistently? Are gestures, buttons, menus, selections, and back behavior predictable? Does simplification on one screen introduce a different convention elsewhere? |
| Search and information | Can people find the appropriate entity without knowing its exact name or internal category? Are empty results, ambiguous entities, duplicates, geographic scope, and stale filters understandable? |

## Real work and its surrounding states

| Lens | Questions that can reveal hidden effort |
| --- | --- |
| Create, edit, and complete | Does an apparent action persist and appear where expected? Are required fields justified? Is useful context retained between steps? Are read, create, edit, cancel, archive, and remove states coherent where applicable? |
| Scheduling and coordination | For existing match/event flows, how do availability, place, time, time zones, participants, invitations, acceptance, rescheduling, and cancellation connect? Can the person arrange something from the context that motivated it? |
| Communication and follow-through | Does a notification explain what happened and lead to the exact next action? Can someone tell whether a request is pending, accepted, rejected, expired, or already handled? Are communication and the underlying record consistent? |
| Commerce and commitments | Where products, jobs, donations, or other commitments exist, are ownership, availability, terms, totals, status, and next steps understandable? Does simpler presentation still expose information needed for the actual decision? Avoid speculative financial or legal claims. |
| Content and media | Are upload, preview, progress, failure, replacement, removal, and visibility understandable? Where relevant, does the interface remain usable with missing, long, large, or differently shaped media/content? |
| Forms and repeated information | What is unnecessarily requested again? Are sensible defaults explainable and editable? Is validation near the problem and actionable? Are drafts, cancellation, unsaved changes, and dependent fields handled coherently? |
| Loading, empty, error, and success | Does each state explain what is happening and what the person can do? Can a skeleton, silent failure, optimistic update, or success message misrepresent persistence? Does an empty state teach the first useful action? |
| Interruptions and concurrency | What survives refresh, back navigation, slow connections, expired sessions, double activation, or another person's edit? Can the person recover without redoing work? Investigate relevant mechanisms and focused scenarios rather than manufacturing every possible fault. |

## Presentation, inclusion, and trust

| Lens | Questions that can reveal hidden effort |
| --- | --- |
| Compactness and hierarchy | Is important information easy to scan? Are density, grouping, spacing, typography, and progressive disclosure reducing effort? Is essential information hidden merely to make a screenshot cleaner? |
| Language and brand | Can a person explain what GrassKickZ offers and recognize its character across screens? Are labels concrete, terminology coherent, and claims supported by working experiences? Identify subjective design judgments and audience assumptions. |
| Responsive and accessible use | Can relevant flows be completed with touch, keyboard, zoom, and assistive semantics? Examine focus, dialogs, labels, errors, contrast, motion, target sizes, narrow screens, overflow, and alternate input where applicable. Source inspection alone does not establish accessibility compliance. |
| Identity, privacy, and permission | Is the affected identity/audience clear? Are sensitive information and consequential actions exposed appropriately? Does an edit/create affordance agree with the real permission and server response? Use isolated data for permission scenarios. |
| Understandable safeguards | Do safeguards address an actual consequence? Could undo, preview, better scope, or clearer wording reduce friction while retaining the necessary control? Do not recommend removing a meaningful authorization or transaction boundary to save a click. |

## Engineering that supports simplicity

| Lens | Questions that can reveal hidden effort |
| --- | --- |
| State and contracts | Which data is authoritative? Are derived state, cache invalidation, optimistic behavior, forms, URLs, and server validation consistent? Does navigation depend on stale or global state that makes contextual commands unreliable? |
| Shared action foundations | Can one intention be invoked from several appropriate places with consistent scope, permission, validation, feedback, and recovery? Is there evidence for a shared primitive, or would a broad command framework be premature? |
| Responsiveness and performance | Where does waiting obstruct an actual journey? Investigate loading strategy, unnecessary fetching/rendering, media, and bundle structure as appropriate. Measure before asserting performance differences; avoid memoization counts as a quality proxy. |
| Maintainability and delivery | What makes new behavior expensive or error-prone to add? Connect duplication, coupling, inconsistent types, styling, or test gaps to an actual change or failure mode. Preserve useful simple implementations; more layers do not inherently improve the product. |
| Future expansion | Can additional discovery, content, commerce, coordination, real-time states, or assisted actions fit coherently? For Dola or browser assistance, inspect stable action names, context, permission, observable state, feedback, and recovery. Evaluate plausible constraints without designing every unbuilt subsystem. |

## Recover value from the current frontend

For each older behavior worth investigating, record its user value and evidence. Look beyond visible screens to defaults, workflow transitions, role-specific behavior, recovery, and edge cases. Determine whether it is still needed and whether its benefit can be expressed with less effort in the sandbox. Preserve reasons and consequences; visual resemblance is not a migration requirement.

Classify an apparent gap according to the evidence: deliberate simplification, unfinished work, potentially lost value, a changed requirement, or unresolved intent. An advantage in one implementation does not establish an overall winner.

## Ask questions the owner has not already asked

Use these prompts to generate hypotheses, then verify them against the product:

- What must a person remember or understand that the interface could carry for them?
- Which task is difficult to discover even though its implementation already exists?
- Which information is entered twice, and which decision is repeated after the context already answered it?
- Where must someone leave their current intention and enter the application's organizational model?
- Which simplified screen shifts effort to another screen, another person, or a later recovery step?
- What looks complete but is mocked, disconnected, ambiguous, or unable to finish the journey?
- Which advanced capability could reuse a simple foundation, and which abstraction would add complexity before it earns its place?
- Which old behavior protects a useful outcome, and what is the simplest new expression of it?
- What works well already and would be damaged by the obvious redesign?
- What recommendation depends on guessing user intent, and what evidence or small experiment would resolve it?

## Skeptical synthesis

After the first pass, review the uncovered areas and the strongest recommendations. Seek another entry point, a counterexample, an intentional tradeoff, or a smaller solution. Connect symptoms with a shared cause only when evidence supports that relationship. Label remaining hypotheses rather than turning them into confident defects.

For the next development sequence, explain which improvements unlock other work, which missing journeys matter now, which useful ideas should be transferred or adapted, and which attractive changes should wait. Keep uncertainty visible and leave the owner with concrete decisions rather than an undifferentiated backlog.
