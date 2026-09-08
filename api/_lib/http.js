export function json(res, status, payload, headers = {}) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.send(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return json(res, 405, { error: 'Method not allowed.' });
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Do not use Vercel's req.query getter here. In the Node runtime it delegates
// to the deprecated legacy url.parse() implementation. Parsing only req.url
// with a fixed base also ensures request Host headers cannot influence URLs.
export function queryParam(req, name) {
  const requestUrl = typeof req?.url === 'string' ? req.url : '/';
  return new URL(requestUrl, 'https://request.invalid').searchParams.get(name) || '';
}

export function setCookie(res, name, value, maxAgeSeconds) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function cookie(req, name) {
  const values = String(req.headers.cookie || '').split(';').map((part) => part.trim());
  const match = values.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function badRequest(res, message) {
  return json(res, 400, { error: message });
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}
