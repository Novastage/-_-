import crypto from 'node:crypto';

export const id = () => crypto.randomUUID();
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function createAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `NOVA-${segment()}-${segment()}`;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  const [algorithm, salt, expected] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function expiresAt(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
