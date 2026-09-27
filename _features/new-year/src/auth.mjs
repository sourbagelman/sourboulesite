// Narrow RS256 verifier for Cloudflare Access using Web Crypto; no bearer token is
// accepted from query strings. Production issuer and audience are pinned in config.
// Cloud integration/rotation must still be tested in a real Access staging app.
const cache = new Map();
function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Bad JWT encoding');
  return Uint8Array.from(atob(segment.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
}
export async function verifyAccess(request, env, now, fetcher = fetch) {
  const issuer = env.ACCESS_ISSUER;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') || !env.ACCESS_AUD)
    throw new Error('Staff authentication unavailable');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16000) throw new Error('Staff sign-in required');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid staff token');
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit)
    throw new Error('Unsupported staff token');
  const sec = now / 1000;
  if (claims.iss !== issuer || !(Array.isArray(claims.aud) ? claims.aud.includes(env.ACCESS_AUD) : claims.aud === env.ACCESS_AUD)
    || !Number.isFinite(claims.exp) || claims.exp <= sec || (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > sec))
    || !claims.sub || typeof claims.sub !== 'string' || typeof claims.email !== 'string')
    throw new Error('Expired or invalid staff token');
  let cached = cache.get(issuer);
  // Refresh expired keys or an unknown kid; no use of token-controlled jku/x5u.
  if (!cached || cached.until < now || !cached.keys.some(k => k.kid === header.kid)) {
    const response = await fetcher(issuer + '/cdn-cgi/access/certs', {signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('Staff key service unavailable');
    const body = await response.json();
    if (!Array.isArray(body.keys)) throw new Error('Invalid key response');
    cached = {keys: body.keys, until: now + 300000}; cache.set(issuer,cached);
  }
  const jwk = cached.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))
    throw new Error('Invalid staff signature');
  const user = await env.DB.prepare('SELECT * FROM staff_users WHERE subject=? AND email=? AND active=1').bind(claims.sub,claims.email.toLowerCase()).first();
  if (!user) throw new Error('Staff access not authorized');
  return {subject: user.subject, email: user.email};
}
