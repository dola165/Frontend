# Temporary payment preview

Store no longer uses this simulator, regardless of the preview switch. Its optional
purchase requests are real server records with seller answers, stock reservations,
cancellation and fulfillment. Payment remains outside GrassKickZ. The cart quote
still checks current prices and stock; it creates no order on its own.

The remaining simulator writes browser test records only. It never posts payments,
stock updates or fundraising totals. The other existing preview consumers are
unchanged by the Store foundation.

`VITE_PAYMENT_PREVIEW` is the one build-time switch:

- Unset: enabled in local Vite development, disabled in production builds.
- `true`: enabled for a prelaunch preview deployment.
- `false`: disabled, including local development.

For launch, set it to `false` and rebuild. Provider payment processing remains unavailable until a real provider is integrated. Deployment alone
does not enable real payments.

To delete the temporary feature, remove this directory and its imports/branches
from its remaining consumers.
Remove the variable from the environment configuration. CommerceDemoPage only
redirects old bookmarks to the store or campaigns; there is no separate demo shop.

Test records use `gk.payment-preview.v1.*` keys scoped to the browser account/session.
They are local examples, not club income or persisted orders. The former fictional
Northstar demonstration keys are not read by the new experience.
