// ======================================================
// CURRENT YEAR
// ======================================================
const currentYear = document.getElementById('currentYear');
if (currentYear) currentYear.textContent = new Date().getFullYear();

// ======================================================
// MOBILE MENU
// ======================================================
const menuToggle = document.getElementById('menuToggle');
const siteNav = document.getElementById('siteNav');
if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => siteNav.classList.toggle('active'));
}

// ======================================================
// NOVA RED LINE ENTRY BUTTON
// CONTACT 오른쪽 / 모바일에서는 CONTACT 아래
// ======================================================
if (siteNav && !siteNav.querySelector('.redline-nav-button')) {
  const redlineButton = document.createElement('a');
  redlineButton.href = '/redline/';
  redlineButton.innerHTML = '<span>NOVA RED LINE</span><small>ONLINE MASTERING</small>';
  redlineButton.className = 'redline-nav-button';
  redlineButton.setAttribute('aria-label', 'Open NOVA RED LINE Online Mastering');

  const contactLink = siteNav.querySelector('a[href="#contact"]');
  if (contactLink) contactLink.insertAdjacentElement('afterend', redlineButton);
  else siteNav.appendChild(redlineButton);

  const redlineStyle = document.createElement('style');
  redlineStyle.textContent = `
    .site-nav .redline-nav-button {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 206px;
      min-height: 48px;
      padding: 8px 22px;
      margin-left: 6px;
      border-radius: 9px;
      background: linear-gradient(180deg,#ff313a 0%,#d90f17 100%);
      border: 1px solid rgba(255,95,104,.55);
      color: #fff !important;
      font-weight: 800;
      line-height: 1.05;
      box-shadow: 0 9px 28px rgba(226,19,28,.28);
      transition: transform .2s ease,filter .2s ease,box-shadow .2s ease;
    }
    .site-nav .redline-nav-button span {
      font-size: 12px;
      letter-spacing: .08em;
    }
    .site-nav .redline-nav-button small {
      margin-top: 4px;
      font-size: 7px;
      font-weight: 600;
      letter-spacing: .18em;
      color: rgba(255,255,255,.72);
    }
    .site-nav .redline-nav-button:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow: 0 13px 36px rgba(226,19,28,.38);
    }
    .site-nav .redline-nav-button::after { display:none !important; }

    @media screen and (max-width: 1250px) and (min-width: 769px) {
      .site-nav { gap: 22px; }
      .site-nav .redline-nav-button {
        min-width: 176px;
        padding-left: 16px;
        padding-right: 16px;
      }
    }

    @media screen and (max-width:768px) {
      .site-nav .redline-nav-button {
        width: 100% !important;
        min-width: 0;
        min-height: 52px;
        margin: 12px 0 4px !important;
        padding: 10px 14px !important;
        text-align: center !important;
        border-bottom: 0 !important;
      }
      .site-nav .redline-nav-button span { font-size: 12px; }
      .site-nav .redline-nav-button small { font-size: 7px; }
    }
  `;
  document.head.appendChild(redlineStyle);
}

// ======================================================
// SMOOTH SECTION NAVIGATION
// ======================================================
const navigationLinks = document.querySelectorAll(
  '.site-nav a[href^="#"], .brand[href^="#"], .hero-buttons a[href^="#"]'
);

navigationLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href');
    if (!targetId || targetId === '#' || !targetId.startsWith('#')) return;

    const target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();
    if (siteNav) siteNav.classList.remove('active');

    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.offsetHeight : 0;
    let destination = 0;

    if (targetId === '#home') {
      destination = 0;
    } else {
      const targetRect = target.getBoundingClientRect();
      const absoluteTop = window.scrollY + targetRect.top;
      const targetHeight = target.offsetHeight;
      const viewportHeight = window.innerHeight;
      const usableHeight = viewportHeight - headerHeight;

      if (targetHeight < usableHeight) {
        destination = absoluteTop - headerHeight - (usableHeight - targetHeight) / 2;
      } else {
        destination = absoluteTop - headerHeight - 24;
      }
    }

    window.scrollTo({ top: Math.max(destination, 0), behavior: 'smooth' });
  });
});

// ======================================================
// STAR FIELD
// ======================================================
const starfield = document.getElementById('starfield');
const starCount = 260;
if (starfield) {
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    const size = Math.random() * 3 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 6}s`;
    star.style.animationDuration = `${Math.random() * 4 + 3}s`;
    star.style.opacity = Math.random() * 0.7 + 0.2;
    starfield.appendChild(star);
  }
}

// ======================================================
// SECTION SCROLL FADE-IN
// ======================================================
const fadeSections = document.querySelectorAll('.section, .hero');
fadeSections.forEach((section) => section.classList.add('fade-section'));

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('show');
    });
  }, { threshold: 0.15 });
  fadeSections.forEach((section) => sectionObserver.observe(section));
} else {
  fadeSections.forEach((section) => section.classList.add('show'));
}

document.querySelector('.hero')?.classList.add('show');

// ======================================================
// FEATURED PROJECTS SCROLL REVEAL
// ======================================================
const projectCards = document.querySelectorAll('.project-card');
if ('IntersectionObserver' in window) {
  const projectObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });
  projectCards.forEach((card) => projectObserver.observe(card));
} else {
  projectCards.forEach((card) => card.classList.add('show'));
}

// ======================================================
// CINEMATIC VIDEO HERO
// assets/hero-bg.mp4 is intentionally used as a muted looping hero.
// WATCH FILM opens the full-length Nova Stage film with sound and controls.
// ======================================================
(() => {
  const hero = document.querySelector('.hero');
  const heroGrid = hero?.querySelector('.hero-grid');
  const heroCopy = hero?.querySelector('.hero-copy');
  const heroVisual = hero?.querySelector('.hero-visual');
  const header = document.querySelector('.site-header');

  if (!hero || !heroGrid || !heroCopy) return;

  hero.classList.add('nova-video-hero');

  const backgroundVideo = document.createElement('video');
  backgroundVideo.className = 'hero-bg-video';
  backgroundVideo.src = 'assets/hero-bg.mp4';
  backgroundVideo.autoplay = true;
  backgroundVideo.muted = true;
  backgroundVideo.loop = true;
  backgroundVideo.playsInline = true;
  backgroundVideo.preload = 'metadata';
  backgroundVideo.setAttribute('aria-hidden', 'true');

  const videoOverlay = document.createElement('div');
  videoOverlay.className = 'hero-video-overlay';
  videoOverlay.setAttribute('aria-hidden', 'true');

  hero.insertBefore(backgroundVideo, hero.firstChild);
  hero.insertBefore(videoOverlay, heroGrid);

  heroCopy.innerHTML = `
    <p class="hero-video-kicker">GLOBAL ENTERTAINMENT &amp; CONTENT IP</p>
    <h1 class="hero-video-title">NOVA STAGE</h1>
    <p class="hero-video-subbrand">ENTERTAINMENT</p>
    <p class="hero-video-tags">MUSIC <span>·</span> PERFORMANCE <span>·</span> EXPERIENCE <span>·</span> FILM <span>·</span> CONTENT IP</p>
    <div class="hero-video-actions">
      <a href="#business" class="btn btn-primary hero-discover-btn">DISCOVER NOVA STAGE</a>
      <button type="button" class="btn btn-secondary hero-film-btn" id="heroFilmBtn" aria-label="Watch Nova Stage film">WATCH FILM</button>
    </div>
    <a href="#about" class="hero-scroll-cue" aria-label="Scroll to About Nova Stage">
      <span>SCROLL TO DISCOVER</span>
      <b>↓</b>
    </a>
  `;

  if (heroVisual) heroVisual.setAttribute('aria-hidden', 'true');

  const heroStyle = document.createElement('style');
  heroStyle.id = 'novaHeroVideoStyle';
  heroStyle.textContent = `
    .site-header {
      position: fixed !important;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 100 !important;
      background: linear-gradient(180deg, rgba(1,5,14,.78) 0%, rgba(1,5,14,.34) 58%, transparent 100%) !important;
      border-bottom-color: transparent !important;
      backdrop-filter: none !important;
      transition: background .35s ease, backdrop-filter .35s ease, border-color .35s ease;
    }

    .site-header.nova-header-scrolled {
      background: rgba(2,8,19,.82) !important;
      border-bottom-color: rgba(255,255,255,.07) !important;
      backdrop-filter: blur(18px) !important;
    }

    .nova-video-hero {
      position: relative !important;
      isolation: isolate;
      min-height: 100vh !important;
      min-height: 100svh !important;
      width: 100%;
      padding: 126px 0 70px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden;
      scroll-margin-top: 0 !important;
      background: #020711;
    }

    .nova-video-hero .hero-bg-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      z-index: -4;
      transform: scale(1.01);
      background: #020711;
    }

    .nova-video-hero .hero-video-overlay {
      position: absolute;
      inset: 0;
      z-index: -3;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 48%, rgba(31,87,160,.08) 0%, rgba(3,8,18,.08) 36%, rgba(1,4,12,.34) 72%, rgba(1,4,12,.58) 100%),
        linear-gradient(180deg, rgba(1,4,12,.24) 0%, rgba(2,7,18,.10) 42%, rgba(1,4,12,.67) 100%);
    }

    .nova-video-hero .hero-grid {
      width: min(1480px, calc(100% - 80px)) !important;
      display: block !important;
      margin: 0 auto !important;
      position: relative;
      z-index: 2;
    }

    .nova-video-hero .hero-copy {
      max-width: 1120px !important;
      margin: 0 auto !important;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .nova-video-hero .hero-visual {
      display: none !important;
    }

    .hero-video-kicker {
      margin: 0 0 16px !important;
      color: rgba(225,241,255,.86) !important;
      font-size: clamp(10px, .8vw, 13px) !important;
      font-weight: 500 !important;
      letter-spacing: .32em !important;
      text-shadow: 0 2px 18px rgba(0,0,0,.7);
    }

    .nova-video-hero .hero-video-title {
      margin: 0 !important;
      color: #fff;
      font-size: clamp(62px, 9.2vw, 152px) !important;
      line-height: .86 !important;
      font-weight: 800 !important;
      letter-spacing: -.055em !important;
      text-shadow: 0 5px 34px rgba(0,0,0,.44), 0 0 44px rgba(85,163,255,.16);
    }

    .hero-video-subbrand {
      margin: 18px 0 24px !important;
      color: rgba(255,255,255,.95) !important;
      font-size: clamp(15px, 1.55vw, 24px) !important;
      line-height: 1 !important;
      font-weight: 400 !important;
      letter-spacing: .58em !important;
      padding-left: .58em;
      text-shadow: 0 3px 24px rgba(0,0,0,.65);
    }

    .hero-video-tags {
      margin: 0 !important;
      color: rgba(232,243,255,.88) !important;
      font-size: clamp(10px, .9vw, 14px) !important;
      line-height: 1.7 !important;
      font-weight: 500 !important;
      letter-spacing: .18em !important;
      text-shadow: 0 2px 15px rgba(0,0,0,.75);
    }

    .hero-video-tags span {
      color: #72e5ff;
      margin: 0 .22em;
    }

    .hero-video-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 34px;
    }

    .hero-video-actions .btn {
      min-width: 210px;
      min-height: 50px;
      border-radius: 999px;
      cursor: pointer;
      font-family: inherit;
      backdrop-filter: blur(10px);
    }

    .hero-video-actions .btn-primary {
      box-shadow: 0 16px 45px rgba(76,206,255,.25), 0 0 26px rgba(77,255,214,.10);
    }

    .hero-film-btn {
      border: 1px solid rgba(255,255,255,.40) !important;
      background: rgba(1,8,20,.28) !important;
      color: #fff !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
    }

    .hero-scroll-cue {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-top: 46px;
      color: rgba(232,243,255,.66);
      font-size: 9px;
      letter-spacing: .24em;
      font-weight: 500;
    }

    .hero-scroll-cue b {
      color: #7fdfff;
      font-size: 17px;
      font-weight: 300;
      animation: novaScrollHint 1.8s ease-in-out infinite;
    }

    @keyframes novaScrollHint {
      0%, 100% { transform: translateY(0); opacity: .45; }
      50% { transform: translateY(6px); opacity: 1; }
    }

    .nova-film-modal {
      position: fixed;
      inset: 0;
      z-index: 5000;
      display: grid;
      place-items: center;
      padding: 34px;
      background: rgba(0,4,12,.92);
      backdrop-filter: blur(16px);
      opacity: 0;
      visibility: hidden;
      transition: opacity .28s ease, visibility .28s ease;
    }

    .nova-film-modal.is-open {
      opacity: 1;
      visibility: visible;
    }

    .nova-film-shell {
      width: min(1180px, 94vw);
      position: relative;
      border-radius: 18px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 34px 100px rgba(0,0,0,.72), 0 0 60px rgba(81,153,255,.12);
      border: 1px solid rgba(255,255,255,.12);
    }

    .nova-film-shell video {
      display: block;
      width: 100%;
      max-height: 82vh;
      background: #000;
    }

    .nova-film-close {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 2;
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,.25);
      background: rgba(0,0,0,.55);
      color: #fff;
      font-size: 23px;
      cursor: pointer;
      backdrop-filter: blur(8px);
    }

    @media screen and (max-width: 768px) {
      .site-header {
        background: linear-gradient(180deg, rgba(1,5,14,.84), rgba(1,5,14,.28) 72%, transparent) !important;
      }

      .site-nav.active {
        background: rgba(2,8,19,.97) !important;
        backdrop-filter: blur(18px);
      }

      .nova-video-hero {
        min-height: 100svh !important;
        padding: 106px 0 56px !important;
      }

      .nova-video-hero .hero-grid {
        width: min(100% - 36px, 720px) !important;
      }

      .nova-video-hero .hero-bg-video {
        object-position: 50% center;
      }

      .nova-video-hero .hero-video-title {
        font-size: clamp(51px, 17vw, 88px) !important;
        line-height: .9 !important;
      }

      .hero-video-subbrand {
        margin-top: 14px !important;
        letter-spacing: .39em !important;
        padding-left: .39em;
      }

      .hero-video-tags {
        max-width: 340px;
        letter-spacing: .11em !important;
      }

      .hero-video-actions {
        width: 100%;
        max-width: 330px;
        gap: 10px;
        margin-top: 28px;
      }

      .hero-video-actions .btn {
        width: 100%;
        min-width: 0;
      }

      .hero-scroll-cue {
        margin-top: 30px;
      }

      .nova-film-modal {
        padding: 12px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero-scroll-cue b { animation: none; }
    }
  `;
  document.head.appendChild(heroStyle);

  // Transparent over video, dark glass after leaving the hero.
  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle('nova-header-scrolled', window.scrollY > 56);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  // Encourage autoplay where permitted. Failure simply leaves the first frame/fallback.
  backgroundVideo.play().catch(() => {});

  // Full-length film modal.
  const modal = document.createElement('div');
  modal.className = 'nova-film-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="nova-film-shell" role="dialog" aria-modal="true" aria-label="Nova Stage film">
      <button type="button" class="nova-film-close" aria-label="Close film">×</button>
      <video src="assets/nova-stage-full-film.mp4" controls playsinline preload="metadata"></video>
    </div>
  `;
  document.body.appendChild(modal);

  const modalVideo = modal.querySelector('video');
  const closeButton = modal.querySelector('.nova-film-close');
  const filmButton = document.getElementById('heroFilmBtn');

  const closeFilm = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.currentTime = 0;
    }
  };

  const openFilm = () => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (modalVideo) {
      modalVideo.muted = false;
      modalVideo.currentTime = 0;
      modalVideo.play().catch(() => {});
    }
  };

  filmButton?.addEventListener('click', openFilm);
  closeButton?.addEventListener('click', closeFilm);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeFilm();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeFilm();
  });
})();
