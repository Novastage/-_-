import { config } from './config.js';
import { hmac } from './crypto.js';
import { query } from './db.js';
import { getClientIp } from './http.js';

export async function checkLoginRateLimit(req, scope) {
  const keyHash = hmac(getClientIp(req), process.env.ACCESS_CODE_PEPPER);
  const interval = `${config.rateLimitWindowSeconds} seconds`;
  const rows = await query(
    `INSERT INTO login_rate_limits (scope, key_hash, window_started_at, attempts)
     VALUES ($1, $2, NOW(), 1)
     ON CONFLICT (scope, key_hash) DO UPDATE SET
       attempts = CASE WHEN login_rate_limits.window_started_at < NOW() - $3::interval THEN 1 ELSE login_rate_limits.attempts + 1 END,
       window_started_at = CASE WHEN login_rate_limits.window_started_at < NOW() - $3::interval THEN NOW() ELSE login_rate_limits.window_started_at END
     RETURNING attempts`,
    [scope, keyHash, interval]
  );
  return rows[0].attempts <= config.rateLimitAttempts;
}
