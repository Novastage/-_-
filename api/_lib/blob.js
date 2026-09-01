import { del, get, head, put } from '@vercel/blob';
import { requireEnvironment } from './config.js';

export async function storePrivateFile(prefix, filename, body, contentType) {
  requireEnvironment('BLOB_READ_WRITE_TOKEN');
  const safeName = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
  return put(`${prefix}/${Date.now()}-${safeName}`, body, { access: 'private', addRandomSuffix: true, contentType });
}

export async function getPrivateFile(pathname) {
  requireEnvironment('BLOB_READ_WRITE_TOKEN');
  return get(pathname, { access: 'private' });
}

export async function headPrivateFile(pathname) {
  requireEnvironment('BLOB_READ_WRITE_TOKEN');
  return head(pathname);
}

export async function removePrivateFile(pathname) {
  if (!pathname) return;
  requireEnvironment('BLOB_READ_WRITE_TOKEN');
  await del(pathname);
}
