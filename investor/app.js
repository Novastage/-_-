const page = document.body.dataset.page;
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requestedTrack = (() => { const slug = String(new URLSearchParams(location.search).get('track') || '').trim().toLowerCase(); return slugPattern.test(slug) ? slug : null; })();
const investorLoginDestination = () => page === 'music' && requestedTrack ? `/investor/?target=music&track=${encodeURIComponent(requestedTrack)}` : '/investor/';

async function api(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 401) { location.replace(investorLoginDestination()); throw new Error('Session expired.'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load private content.');
  return data;
}

async function logout() {
  await fetch('/api/auth?role=investor&action=logout', { method:'POST' });
  location.assign('/investor/');
}
document.querySelectorAll('.logout-link').forEach((button) => button.addEventListener('click', logout));

try {
  await api('/api/auth?role=investor&action=session');
  if (page === 'overview') {
    const data = await api('/api/investor/content?type=overview');
    document.querySelector('#welcome').textContent = `${data.investor.label}${data.investor.company ? ` · ${data.investor.company}` : ''} 님을 위한 NOVA STAGE Investor Room입니다.`;
    document.querySelector('#music-count').textContent = `${data.counts.music} Tracks`;
    document.querySelector('#global-count').textContent = `${data.counts.global} Representatives`;
  }
  if (page === 'music') {
    const { tracks } = await api('/api/investor/content?type=music');
    const trackCard = (track) => `<article class="item${track.slug === requestedTrack ? ' deep-linked' : ''}"${track.slug ? ` id="track-${escape(track.slug)}" tabindex="-1"` : ''}><span class="tag">${escape(track.category)}</span><h2>${escape(track.title)}</h2>${track.slug ? `<p class="meta">Catalog ID · ${escape(track.slug)}</p>` : ''}<p>${[track.genre, track.concept, track.target_artist].filter(Boolean).map(escape).join(' · ')}</p>${track.description ? `<p>${escape(track.description)}</p>` : ''}<audio controls preload="none" src="${encodeURI(track.streamUrl)}"></audio></article>`;
    const maleTracks = tracks.filter((track) => track.category === 'MALE');
    const femaleTracks = tracks.filter((track) => track.category === 'FEMALE');
    document.querySelector('#music-grid').innerHTML = tracks.length ? `${requestedTrack && !tracks.some((track) => track.slug === requestedTrack) ? '<p class="loading">The requested private track is not currently available.</p>' : ''}<section class="library-group"><h2>Male Group</h2><div class="grid">${maleTracks.length ? maleTracks.map(trackCard).join('') : '<p class="loading">등록된 남성 그룹 트랙이 없습니다.</p>'}</div></section><section class="library-group"><h2>Female Group</h2><div class="grid">${femaleTracks.length ? femaleTracks.map(trackCard).join('') : '<p class="loading">등록된 여성 그룹 트랙이 없습니다.</p>'}</div></section>` : '<p class="loading">등록된 트랙이 아직 없습니다.</p>';
    const highlighted = requestedTrack && document.querySelector(`#track-${requestedTrack}`);
    if (highlighted) { highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' }); highlighted.focus({ preventScroll: true }); }
  }
  if (page === 'global') {
    const { representatives } = await api('/api/investor/content?type=global');
    document.querySelector('#global-grid').innerHTML = representatives.length ? representatives.map((rep) => `<article class="item">${rep.profilePhotoUrl ? `<img alt="" src="${encodeURI(rep.profilePhotoUrl)}" style="width:64px;height:64px;object-fit:cover;border-radius:50%;border:1px solid var(--gold)">` : ''}<span class="tag">${escape(rep.country)}</span><h2>${escape(rep.name || rep.country)}</h2><p>${escape([rep.position, rep.role].filter(Boolean).join(' · '))}</p>${rep.short_bio ? `<p>${escape(rep.short_bio)}</p>` : ''}<a class="button secondary" target="_blank" rel="noopener" href="${encodeURI(rep.profilePdfUrl)}">Profile PDF</a></article>`).join('') : '<p class="loading">등록된 글로벌 대표 정보가 아직 없습니다.</p>';
  }
} catch (error) {
  const target = document.querySelector('.loading, #welcome');
  if (target) target.textContent = error.message || 'Private content could not be loaded.';
}
