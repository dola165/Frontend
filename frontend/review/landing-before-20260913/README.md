# Before the landing redesign

These are exact copies of the working landing page and Playground before the 2026-09-13 redesign. They include the pre-existing working changes, not just the previous Git commit. They are retained for design reference and selective restoration.

The new landing page preserves the existing login endpoint, session establishment, profile completion flow, and safe post-login destination. Its map uses the same shared light map implementation. Styling is scoped to `.gk-landing`; the embedded filter positioning override does not affect `/world`.

The new Playground is loaded only from the footer and mounts its animation only while its modal is open. Native dialog behavior contains focus; dismissal restores focus and body scrolling. Controls support touch, pointer aiming, angle and power sliders, and keyboard shooting. Scores last only for the current open session; changing pitch challenge resets the score. The old full-page physics sandbox is preserved in this folder.
