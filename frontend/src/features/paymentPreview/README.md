# Temporary payment preview

The real store, product pages, cart and campaign pages are used throughout. Cart
totals come from `/store/cart/quote`; campaigns are checked again before a test.
The simulator writes only browser test records. It never posts orders, payments,
stock updates or fundraising totals. It retains the cart for repeated testing.

`VITE_PAYMENT_PREVIEW` is the one build-time switch:

- Unset: enabled in local Vite development, disabled in production builds.
- `true`: enabled for a prelaunch preview deployment.
- `false`: disabled, including local development.

For launch, set it to `false` and rebuild. Existing checkout/contribution
unavailable states remain until a real provider is integrated. Deployment alone
does not enable real payments.

To delete the temporary feature, remove this directory and its imports/branches
from StorePage, StoreProductPage, StoreCartPage, CampaignsPage and CampaignDetailPage.
Remove the variable from the environment configuration. CommerceDemoPage only
redirects old bookmarks to the store or campaigns; there is no separate demo shop.

Test records use `gk.payment-preview.v1.*` keys scoped to the browser account/session.
They are local examples, not club income or persisted orders. The former fictional
Northstar demonstration keys are not read by the new experience.
