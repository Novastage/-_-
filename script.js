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
