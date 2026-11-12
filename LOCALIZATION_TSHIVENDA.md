# LocalPay Micro localization: English / Tshivenda

The web UI uses **static, version-controlled message dictionaries**, not an LLM or an external translation API.

## Implementation
- `frontend/lib/language.tsx`: React context with English (`en`) and Tshivenda (`ve`) dictionaries. Missing translated keys fall back to English.
- `frontend/components/LanguageSwitcher.tsx`: accessible English / Tshivenda dropdown, shown on every page, including public checkout.
- `frontend/app/layout.tsx`: wraps the website in LanguageProvider and renders the selector.
- Preference is stored in browser localStorage under `localpay-language` and reused on subsequent visits; the page's HTML lang is updated.
- First-pass translation applies to important public checkout instructions, sign-in and registration, onboarding, merchant navigation, payment form labels and transaction history headers.
- This is a **first-pass localization**, not complete translation of every website sentence. English remains available on all pages and for untranslated messages.

## Safety and language review
- The Tshivenda strings are **drafts** and MUST be reviewed by a fluent native speaker familiar with finance, commerce, and payment consent before any production launch. A draft-warning appears on the Tshivenda checkout.
- Currency amounts, merchant IDs, card data, Paystack reference IDs, payment statuses, URLs, API request fields and verified payment records remain unchanged by language selection.
- Customer- or merchant-entered business names and descriptions are displayed as provided rather than AI-translated.
- Server errors and Paystack-hosted checkout may remain in English until their provider-supported localization is reviewed.
- Do not machine-translate legal terms, fee disclosures, security warnings or consent text without human review.
- Paystack remains a hosted TEST checkout; LocalPay cannot automatically change the provider's language by translating its own website.

## Do we need NVIDIA NIM?
**No** for interface localization. Using NIM on every page view adds latency, cost, network dependency, and the risk of translating payment amounts or warnings incorrectly. If later adding a customer-support chatbot:
1. Call NIM from a backend-only endpoint with its key in Render environment, never `NEXT_PUBLIC_*`.
2. Redact payment data, email addresses, secrets, references and personal details.
3. Rate limit and monitor requests and get consent if sending user chat text externally.
4. Keep static safety/checkout translations as the only authoritative payment instructions.
5. Use language review and retrieval of approved support content; never let model output set transaction status or payment instructions.

## Review and testing checklist
1. Open each route in a private browser; choose Tshivenda. Verify labels change without login, even on `/pay/{token}`.
2. Switch to English and reload; verify the choice persists.
3. Create a new payment link, open it in a separate browser, review the merchant name and ZAR amount in both languages.
4. Enter payer details, initiate a sandbox checkout, return to LocalPay. Ensure references, amounts and server-verified status are identical in both languages.
5. Verify merchant dashboard, login, signup, onboarding and QR pages on mobile screen sizes.
6. Run a native Tshivenda review, with translations for all remaining page copy and legal disclosures before marking localization complete.
7. Confirm current Vercel production deployment is public and that the latest commit has successfully deployed; it previously hit a build-rate limit.
