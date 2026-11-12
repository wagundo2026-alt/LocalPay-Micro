import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
export function getSupabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('https://') || url.includes('YOUR_PROJECT')) {
    throw new Error('Authentication is not configured yet. Ask the LocalPay administrator to set the Supabase environment variables on Vercel.');
  }
  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}
