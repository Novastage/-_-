const trackSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const invalidSlug = (message) => Object.assign(new Error(message), { code: 'INVALID_SLUG' });

export function normalizeTrackSlug(value, { required = false } = {}) {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug) {
    if (required) throw invalidSlug('A stable music slug is required.');
    return null;
  }
  if (slug.length > 80 || !trackSlugPattern.test(slug)) throw invalidSlug('Use lowercase letters, numbers, and single hyphens for the music slug.');
  return slug;
}
