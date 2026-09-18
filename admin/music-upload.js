import { upload } from 'https://esm.sh/@vercel/blob@2.8.0/client?bundle';

const form = document.querySelector('#music-form');
const noticeNode = document.querySelector('#music-notice');
const musicList = document.querySelector('#music');
const mimeFor = (file) => file.type || ({ mp3:'audio/mpeg', wav:'audio/wav' }[file.name.split('.').pop().toLowerCase()] || 'application/octet-stream');
const safeFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);

function notice(message, ok = false) {
  if (!noticeNode) return;
  noticeNode.textContent = message;
  noticeNode.classList.toggle('ok', ok);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function renderMusic(tracks) {
  if (!musicList) return;
  musicList.innerHTML = tracks.length ? tracks.map((track) => `<div class="row"><div><strong>${escape(track.title)}</strong><small>${escape(track.category)} · ${escape(track.genre || 'No genre')} · ${track.slug ? `Slug: ${escape(track.slug)}` : 'No QR slug'} · ${track.is_active ? 'Active' : 'Hidden'}</small></div><div><button class="button secondary edit-music" type="button" data-id="${track.id}" data-title="${escape(track.title)}" data-genre="${escape(track.genre || '')}" data-slug="${escape(track.slug || '')}">Edit</button> <button class="button secondary replace-music" type="button" data-id="${track.id}">Replace file</button> <button class="button danger delete-music" type="button" data-id="${track.id}">Delete</button></div></div>`).join('') : '<p class="helper">No music yet.</p>';
}

async function refreshMusic() {
  const data = await request('/api/admin/music', { credentials:'same-origin' });
  renderMusic(data.tracks || []);
}

if (form) {
  document.addEventListener('submit', async (event) => {
    if (event.target !== form) return;

    // This capture-phase controller deliberately owns only the music form.
    // It prevents the legacy fire-and-forget handler from reporting success before
    // the database row actually exists.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const fields = Object.fromEntries(new FormData(form));
      const file = form.elements.file?.files?.[0];
      if (!file) throw new Error('Choose a music file first.');

      const mimeType = mimeFor(file);
      const payload = {
        title: fields.title,
        slug: fields.slug,
        category: fields.category,
        genre: fields.genre,
        concept: fields.concept,
        targetArtist: fields.targetArtist,
        description: fields.description,
        displayOrder: fields.displayOrder
      };

      notice('Checking music library…');
      await request('/api/admin/music-finalize', {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ action:'preflight', ...payload })
      });

      const pathname = `investor-room/music/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const blob = await upload(pathname, file, {
        access:'private',
        contentType:mimeType,
        handleUploadUrl:'/api/upload',
        clientPayload:JSON.stringify({ kind:'music', ...payload, uploadMimeType:mimeType, uploadSizeBytes:file.size }),
        multipart:file.size > 100 * 1024 * 1024,
        onUploadProgress:({ percentage }) => notice(`Uploading securely… ${Math.round(percentage)}%`)
      });

      notice('File uploaded. Confirming library registration…');
      await request('/api/admin/music-finalize', {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ action:'finalize', ...payload, pathname:blob.pathname, contentType:blob.contentType || mimeType })
      });

      await refreshMusic();
      form.reset();
      notice('Music upload and library registration completed.', true);
    } catch (error) {
      console.error('NOVA_MUSIC_UPLOAD_FINALIZE_ERROR', error);
      notice(error.message || 'Music upload failed.');
    } finally {
      if (button) button.disabled = false;
    }
  }, true);
}
