import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_RENDER_API = 'https://localpay-micro1.onrender.com';
// Expose only intentional browser API routes. Webhooks, internal demo mutation
// endpoints and any future admin/debug routes must never be proxied by default.
const PUBLIC_READ = [
  /^api\/health$/, /^api\/health\/database$/,
  /^api\/checkout\/[A-Za-z0-9_-]{1,120}$/,
  /^api\/payments\/verify\/LPM-[a-f0-9]{32}$/,
  /^api\/receipts\/LPM-[a-f0-9]{32}$/,
];
const PRIVATE_READ = [
  /^api\/merchant\/me$/, /^api\/merchant\/plan$/,
  /^api\/payment-links$/, /^api\/transactions$/, /^api\/transactions\/export\.csv$/,
  /^api\/dashboard\/(bootstrap|summary|analytics)$/,
  /^api\/subscriptions$/, /^api\/admin\/(summary|merchants|transactions)$/,
];
const PRIVATE_WRITE = [
  /^api\/merchant\/(onboard|upgrade-request)$/, /^api\/payment-links$/,
  /^api\/merchant\/me$/,
];
const PUBLIC_WRITE = [/^api\/payments\/initialize$/];
function permittedApiPath(path: string, method: string, hasAuth: boolean) {
  const routes=method==='GET'?PUBLIC_READ:method==='POST'?PUBLIC_WRITE:[];
  if(routes.some(re=>re.test(path)))return true;
  const privateRoutes=method==='GET'?PRIVATE_READ:method==='POST'||method==='PATCH'?PRIVATE_WRITE:[];
  return hasAuth&&privateRoutes.some(re=>re.test(path));
}


function renderOrigin(): string {
  const configured = process.env.RENDER_API_URL || FALLBACK_RENDER_API;
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
    throw new Error('The Render backend URL must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('Invalid backend URL configuration.');
  return url.origin;
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length || path[0] !== 'api' || path.length > 6 ||
      path.some(item => !/^[a-zA-Z0-9._-]{1,120}$/.test(item) || item === '..')) {
    return NextResponse.json({ data: null, error: 'Unsupported API path.' }, { status: 404 });
  }
  const pathKey=path.join('/');
  const auth=request.headers.get('authorization');
  if(!permittedApiPath(pathKey,request.method,Boolean(auth?.startsWith('Bearer ')))) {
    return NextResponse.json({data:null,error:'This API route is not available.'},{status:404,headers:{'Cache-Control':'no-store'}});
  }
  const targetPath = '/' + path.map(encodeURIComponent).join('/');
  const search = request.nextUrl.search;
  let endpoint: string;
  try { endpoint = renderOrigin() + targetPath + search; }
  catch { return NextResponse.json({ data: null, error: 'The backend API URL is not configured correctly.' }, { status: 503 }); }

  const headers = new Headers();
  if (auth?.startsWith('Bearer ') && auth.length < 9000) headers.set('Authorization', auth);
  if (request.headers.get('content-type')?.startsWith('application/json')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 128 * 1024) {
      return NextResponse.json({ data: null, error: 'Request is too large.' }, { status: 413 });
    }
    const response = await fetch(endpoint, {
      method: request.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(45000),
    });
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ data: null, error: 'The backend returned an unexpected redirect.' }, { status: 502 });
    }
    const mediaType = response.headers.get('content-type') || '';
    const allowedType = mediaType.includes('text/csv') ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';
    if (!mediaType.includes('application/json') && !mediaType.includes('text/csv')) {
      // Never forward untrusted Render HTML to the browser. Report only the status
      // and a helpful explanation, with no secrets or upstream page contents.
      const error = response.status === 404
        ? 'Render returned HTTP 404: this backend API route was not found. Deploy the latest GitHub commit to the correct Render Web Service, with Root Directory set to backend.'
        : response.status === 502 || response.status === 503 || response.status === 504
          ? 'Render returned HTTP ' + response.status + ': the backend is unavailable. Check Render service status and deploy logs.'
          : response.status === 401 || response.status === 403
            ? 'Render returned HTTP ' + response.status + ': an upstream access restriction is blocking this API request.'
            : 'Render returned HTTP ' + response.status + ' instead of a JSON API response. Confirm the backend URL and deployment logs.';
      return NextResponse.json({ data: null, error }, {
        status: 502, headers: { 'Cache-Control': 'no-store' }
      });
    }
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'Content-Type': allowedType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(mediaType.includes('text/csv') ? {
          'Content-Disposition': 'attachment; filename="localpay-transactions.csv"'
        } : {}),
      },
    });
  } catch {
    return NextResponse.json({
      data: null,
      error: 'LocalPay could not reach the Render backend. Verify the service is Live and the backend URL is correct.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
