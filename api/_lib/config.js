function integer(name, fallback, minimum = 1) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

const minimumPdfUploadBytes = 50 * 1024 * 1024;

export const config = {
  investorSessionSeconds: integer('INVESTOR_SESSION_DURATION_SECONDS', 7200),
  adminSessionSeconds: integer('ADMIN_SESSION_DURATION_SECONDS', 28800),
  rateLimitAttempts: integer('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 8),
  rateLimitWindowSeconds: integer('LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900),
  maxAudioBytes: integer('MAX_AUDIO_UPLOAD_BYTES', 1073741824),
  // A stale lower environment value must not prevent a normal investor profile PDF.
  maxPdfBytes: Math.max(integer('MAX_PDF_UPLOAD_BYTES', minimumPdfUploadBytes), minimumPdfUploadBytes)
};

export function requireEnvironment(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Service configuration is incomplete: ${missing.join(', ')}`);
    error.code = 'CONFIGURATION_REQUIRED';
    throw error;
  }
}
