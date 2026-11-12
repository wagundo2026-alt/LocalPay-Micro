# Public customer checkout (Vercel protection fix)

## Problem
The dashboard previously used window.location.origin when creating a QR/payment URL. When a merchant used a protected Vercel preview/deployment URL, the customer was redirected to a Vercel login page before the public /pay/[id] checkout could load. Vercel Authentication runs before Next.js routing, so no middleware or client-side code can bypass it.

## Fix in the code
- The authenticated dashboard bootstrap API now returns the configured FRONTEND_URL as checkout_origin.
- The merchant dashboard builds all QR and shareable links using checkout_origin rather than the merchant's current preview origin.
- If the production checkout origin is missing or looks like a protected preview domain, sharing is disabled and the merchant sees an explanatory message.
- /pay/[id] is a PUBLIC Next.js page without Supabase login. It displays verified-by-backend merchant information, amount, payer form and redirects to Paystack TEST hosted checkout only after the customer confirms.

## Required Vercel settings (project owner action)
1. In the LocalPay Vercel project, open Settings > Deployment Protection (or Security > Deployment Protection).
2. Choose Standard Protection so preview and deployment URLs may remain protected while the production domain is public. Do NOT use All Deployments for a public customer checkout.
3. In Project > Domains, identify the stable public production hostname and confirm it opens in an incognito browser WITHOUT a Vercel login.
4. In the Render backend service Environment, set FRONTEND_URL to exactly https://YOUR-PUBLIC-PRODUCTION-DOMAIN with no path, slash or query. This also controls the Paystack callback origin.
5. Optionally set NEXT_PUBLIC_CHECKOUT_ORIGIN to the same URL in Vercel, but the backend FRONTEND_URL is preferred.
6. Redeploy the updated code in Vercel and Render. If the Vercel build-rate limit blocks deployment, fix that first.

## Validation
- On a fresh private browser, visit https://YOUR-PUBLIC-PRODUCTION-DOMAIN/pay/INVALID and confirm you see the LocalPay payment-link error screen, NOT Vercel sign-in.
- Log in as a merchant on any approved deployment, generate one new link, and verify it uses the production domain, not the long preview deployment URL.
- Open the link on another browser/device with no Vercel login. Confirm it shows the merchant, amount and payer form.
- Complete Paystack test checkout and check server-side verification. Do not infer payment success from the redirect alone.
- Confirm links expire after 24 hours, cannot be used for a second checkout and merchants can revoke unused links.

Operational note: The Vercel project belongs to the low-cost team, which this current Vercel integration could not access (403 scope forbidden). The assistant cannot change its Deployment Protection settings until the account authorizes access or the owner changes the setting in the Vercel dashboard.