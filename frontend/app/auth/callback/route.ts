import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next') || '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';
  if (!code) return NextResponse.redirect(new URL('/login?error=confirmation', origin));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.redirect(new URL('/login?error=config', origin));
  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = createServerClient(url,key,{
    cookies:{
      getAll(){return cookieStore.getAll()},
      setAll(list){for (const cookie of list) {cookieStore.set(cookie.name,cookie.value,cookie.options);response.cookies.set(cookie.name,cookie.value,cookie.options)}}
    }
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=confirmation', origin));
  return response;
}
