# Club workflows and registration — 14 September 2026

Scope: Applications and Tryouts workflow, player-facing club journey, daily Club Overview, Parent signup/onboarding/first-use routing, and restoration of the existing verification email configuration.

The API is built from the previously deployed immutable V91 image. Only the shared UserType class family and V91.1 Parent account constraint were added. Other pending backend changes and V92/V93 are excluded. Parent is an account persona; verified adult guardian links still control child access.

Existing Resend credentials and the verified sending domain are sourced from the local project into the deployment's external secret file and sender variable. Credentials are not included in release artifacts. No real test emails or live test accounts are created.

Validation: focused auth, overview, recruitment and player-journey checks; desktop/mobile EN/KA previews; production build; isolated exact-image signup → captured verification link → password login → empty Parent Hub. Restricted Agent signup and unverified login remain rejected. Registration evidence is in registration-check.json.

Deployment uses the established operation lock, an encrypted pre-release backup, immutable images and a release journal. release-result.json records completion and public asset verification. No data reset, schema downgrade or live restore is performed.

Consent Overview intentionally reports bounded coverage (up to 50 active players and 50 trialists), because the current API has no club-wide consent aggregate.
