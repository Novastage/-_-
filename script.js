// ======================================================
// CURRENT YEAR
// ======================================================

const currentYear =
  document.getElementById("currentYear");

if (currentYear) {
  currentYear.textContent =
    new Date().getFullYear();
}


// ======================================================
// MOBILE MENU
// ======================================================

const menuToggle =
  document.getElementById("menuToggle");

const siteNav =
  document.getElementById("siteNav");


if (menuToggle && siteNav) {

  menuToggle.addEventListener(
    "click",
    () => {

      siteNav.classList.toggle("active");

    }
  );

}


// ======================================================
// SMOOTH SECTION NAVIGATION
//
// 중요:
// 모든 메뉴 이동은 이 코드 하나만 담당합니다.
// ======================================================

const navigationLinks =
  document.querySelectorAll(
    '.site-nav a[href^="#"], .brand[href^="#"], .hero-buttons a[href^="#"]'
  );


navigationLinks.forEach((link) => {

  link.addEventListener(
    "click",
    (event) => {

      const targetId =
        link.getAttribute("href");


      if (
        !targetId ||
        targetId === "#" ||
        !targetId.startsWith("#")
      ) {
        return;
      }


      const target =
        document.querySelector(targetId);


      if (!target) {
        return;
      }


      event.preventDefault();


      // 모바일 메뉴 닫기
      if (siteNav) {
        siteNav.classList.remove("active");
      }


      // 헤더 높이 계산
      const header =
        document.querySelector(
          ".site-header"
        );


      const headerHeight =
        header
          ? header.offsetHeight
          : 0;


      let destination = 0;


      // ==================================================
      // HOME
      // ==================================================

      if (targetId === "#home") {

        destination = 0;

      }


      // ==================================================
      // OTHER SECTIONS
      // ==================================================

      else {

        const targetRect =
          target.getBoundingClientRect();


        /*
          현재 스크롤 위치 +
          현재 화면에서의 target 위치

          = 문서 전체 기준 target 위치
        */
        const absoluteTop =
          window.scrollY +
          targetRect.top;


        const targetHeight =
          target.offsetHeight;


        const viewportHeight =
          window.innerHeight;


        const usableHeight =
          viewportHeight -
          headerHeight;


        /*
          섹션 내용이 한 화면 안에 들어오면
          섹션을 화면 가운데 배치
        */
        if (
          targetHeight <
          usableHeight
        ) {

          destination =
            absoluteTop
            -
            headerHeight
            -
            (
              usableHeight -
              targetHeight
            ) / 2;

        }


        /*
          ABOUT처럼 내용이 긴 섹션은
          제목이 헤더 아래에서 시작하도록 배치
        */
        else {

          destination =
            absoluteTop
            -
            headerHeight
            -
            24;

        }

      }


      /*
        딱 한 번만 이동합니다.
        중간 보정 이동 없음.
      */
      window.scrollTo({

        top:
          Math.max(
            destination,
            0
          ),

        behavior: "smooth"

      });

    }

  );

});


// ======================================================
// STAR FIELD
// ======================================================

const starfield =
  document.getElementById("starfield");


const starCount = 260;


if (starfield) {

  for (
    let i = 0;
    i < starCount;
    i++
  ) {

    const star =
      document.createElement("span");


    star.classList.add("star");


    const size =
      Math.random() * 3 + 1;


    const posX =
      Math.random() * 100;


    const posY =
      Math.random() * 100;


    const delay =
      Math.random() * 6;


    const duration =
      Math.random() * 4 + 3;


    const opacity =
      Math.random() * 0.7 + 0.2;


    star.style.width =
      `${size}px`;


    star.style.height =
      `${size}px`;


    star.style.left =
      `${posX}%`;


    star.style.top =
      `${posY}%`;


    star.style.animationDelay =
      `${delay}s`;


    star.style.animationDuration =
      `${duration}s`;


    star.style.opacity =
      opacity;


    starfield.appendChild(star);

  }

}


// ======================================================
// SECTION SCROLL FADE-IN
// ======================================================

const fadeSections =
  document.querySelectorAll(
    ".section, .hero"
  );


fadeSections.forEach(
  (section) => {

    section.classList.add(
      "fade-section"
    );

  }
);


const sectionObserver =
  new IntersectionObserver(

    (entries) => {

      entries.forEach(
        (entry) => {

          if (
            entry.isIntersecting
          ) {

            entry.target.classList.add(
              "show"
            );

          }

        }
      );

    },

    {
      threshold: 0.15
    }

  );


fadeSections.forEach(
  (section) => {

    sectionObserver.observe(
      section
    );

  }
);


// 첫 화면 바로 표시
document
  .querySelector(".hero")
  ?.classList.add("show");


// ======================================================
// FEATURED PROJECTS
// SCROLL REVEAL
// ======================================================

const projectCards =
  document.querySelectorAll(
    ".project-card"
  );


const projectObserver =
  new IntersectionObserver(

    (entries, observer) => {

      entries.forEach(
        (entry) => {

          if (
            entry.isIntersecting
          ) {

            entry.target.classList.add(
              "show"
            );


            observer.unobserve(
              entry.target
            );

          }

        }
      );

    },

    {
      threshold: 0.18
    }

  );


projectCards.forEach(
  (card) => {

    projectObserver.observe(
      card
    );

  }
);


// ======================================================
// NOVA RED LINE PRODUCT ENTRY
// ======================================================

(function mountRedLineStorefrontEntry() {
  if (!document.body || document.querySelector('.redline-home-section')) return;

  const style = document.createElement('style');
  style.textContent = `
    .redline-nav-link{color:#ff6a78!important;font-weight:700!important}
    .redline-home-section{position:relative;z-index:2;padding:92px 0;min-height:auto!important}
    .redline-home-card{position:relative;overflow:hidden;display:grid;grid-template-columns:1.05fr .95fr;gap:46px;align-items:center;padding:46px;border:1px solid rgba(255,72,86,.24);border-radius:28px;background:radial-gradient(circle at 82% 20%,rgba(255,39,57,.18),transparent 34%),linear-gradient(140deg,rgba(25,8,14,.86),rgba(5,10,18,.92));box-shadow:0 28px 80px rgba(0,0,0,.38)}
    .redline-home-kicker{margin:0 0 10px;color:#ff6a78;font-size:12px;font-weight:800;letter-spacing:.22em}
    .redline-home-card h2{margin:0 0 18px;font-size:clamp(38px,4.5vw,64px);line-height:.98;letter-spacing:-.04em}
    .redline-home-card h2 span{color:#ff2b40}
    .redline-home-card p{max-width:680px}
    .redline-home-buttons{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
    .redline-home-buy{background:linear-gradient(90deg,#ff3348,#c6001b)!important;color:#fff!important;box-shadow:0 12px 36px rgba(255,36,56,.24)!important}
    .redline-home-visual{min-height:300px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#0b0c10;padding:18px;box-shadow:inset 0 0 80px rgba(255,36,56,.05)}
    .redline-ui-head{height:40px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#15171c;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#aeb2bb;font-size:10px}
    .redline-ui-head b{color:#fff}.redline-ui-head b span{color:#ff3045}
    .redline-ui-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.redline-ui-box{min-height:82px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:#121419;padding:11px}.redline-ui-box.wide{grid-column:1/-1}.redline-ui-label{color:#8d929c;font-size:9px;letter-spacing:.1em}.redline-ui-meter{height:5px;background:#2c2e34;border-radius:99px;margin-top:13px;overflow:hidden}.redline-ui-meter i{display:block;height:100%;background:linear-gradient(90deg,#850d1c,#ff3045)}
    @media(max-width:980px){.redline-home-card{grid-template-columns:1fr}.redline-home-section{padding:64px 0}}
    @media(max-width:640px){.redline-home-card{padding:26px}.redline-home-visual{min-height:250px}}
  `;
  document.head.appendChild(style);

  if (siteNav) {
    const navLink = document.createElement('a');
    navLink.href = '/redline/';
    navLink.className = 'redline-nav-link';
    navLink.textContent = 'RED LINE';
    siteNav.insertBefore(navLink, siteNav.querySelector('a[href="#investor"]') || null);
  }

  const heroButtons = document.querySelector('.hero-buttons');
  if (heroButtons) {
    const productButton = document.createElement('a');
    productButton.href = '/redline/';
    productButton.className = 'btn btn-secondary';
    productButton.textContent = 'NOVA RED LINE';
    heroButtons.appendChild(productButton);
  }

  const investorSection = document.getElementById('investor');
  const redlineSection = document.createElement('section');
  redlineSection.className = 'section redline-home-section show';
  redlineSection.id = 'redline-product';
  redlineSection.innerHTML = `
    <div class="container">
      <div class="redline-home-card">
        <div>
          <p class="redline-home-kicker">NOVA STAGE SOFTWARE · PROFESSIONAL AUDIO</p>
          <h2>NOVA <span>RED LINE</span><br>MASTERING WORKSTATION</h2>
          <p>One-click Auto Mastering, expert EQ and dynamics, Reference Assist, LUFS / True Peak monitoring and professional delivery in one Windows workstation.</p>
          <div class="redline-home-buttons">
            <a class="btn redline-home-buy" href="/redline/">PRODUCT DETAILS</a>
            <a class="btn btn-secondary" href="/redline/professional/">BUY PROFESSIONAL</a>
          </div>
        </div>
        <div class="redline-home-visual" aria-label="NOVA RED LINE software preview">
          <div class="redline-ui-head"><b>NOVA <span>RED LINE</span></b><span>V3.8.0 PROFESSIONAL</span></div>
          <div class="redline-ui-grid">
            <div class="redline-ui-box"><div class="redline-ui-label">AUTO MASTER</div><div class="redline-ui-meter"><i style="width:86%"></i></div><div class="redline-ui-meter"><i style="width:64%"></i></div></div>
            <div class="redline-ui-box"><div class="redline-ui-label">LUFS / TRUE PEAK</div><div class="redline-ui-meter"><i style="width:72%"></i></div><div class="redline-ui-meter"><i style="width:58%"></i></div></div>
            <div class="redline-ui-box wide"><div class="redline-ui-label">REFERENCE ASSIST · EXPERT MASTERING · FINAL AUDIT</div><div class="redline-ui-meter"><i style="width:91%"></i></div></div>
          </div>
        </div>
      </div>
    </div>`;

  if (investorSection?.parentNode) investorSection.parentNode.insertBefore(redlineSection, investorSection);
  else document.querySelector('main')?.appendChild(redlineSection);
})();
