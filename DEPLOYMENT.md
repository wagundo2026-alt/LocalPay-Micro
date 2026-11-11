# LocalPay Micro — demo deployment

The full working-tree source must be uploaded from the completed source ZIP before deploying. This repository currently contains build/deployment configuration and a README; configuration alone cannot launch the app.

## Supabase
1. Create a project.
2. Run `supabase/migrations/001_initial.sql` after uploading the source.
3. Configure email auth redirect URLs for your frontend.

## Render (Flask)
Create a Render Blueprint from `render.yaml`. Supply these **server-side** environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_ORIGINS` (exact Vercel origin)
- `ENABLE_DEMO_PAYMENTS=false` by default

## Vercel (Next.js)
Import the repo using root directory `frontend`. Supply:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public client key)
- `NEXT_PUBLIC_API_URL` (Render API origin)

No real PSP, webhook verification, subscription billing, or live fund transfers are implemented. The hackathon simulator must never be misrepresented as payment confirmation or enabled for live finance.
