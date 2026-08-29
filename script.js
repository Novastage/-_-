// 현재 연도 자동 표시
document.getElementById("currentYear").textContent = new Date().getFullYear();

// 모바일 메뉴 토글
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

menuToggle.addEventListener("click", () => {
  siteNav.classList.toggle("active");
});

// ======================================================
// 메뉴 클릭 시 해당 섹션을 화면 중앙으로 이동
// ======================================================

document.querySelectorAll(".site-nav a").forEach((link) => {

  link.addEventListener("click", (event) => {

    const targetId = link.getAttribute("href");

    if (!targetId || !targetId.startsWith("#")) {
      return;
    }

    event.preventDefault();

    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    // 모바일 메뉴 닫기
    siteNav.classList.remove("active");


    const header =
      document.querySelector(".site-header");

    const headerHeight =
      header ? header.offsetHeight : 0;


    const viewportHeight =
      window.innerHeight;

    const targetHeight =
      target.offsetHeight;


    let targetPosition;


    /*
      섹션 내용이 화면보다 작으면
      화면 중앙에 배치
    */
    if (
      targetHeight <
      viewportHeight - headerHeight
    ) {

      targetPosition =
        target.offsetTop
        - ((viewportHeight - targetHeight) / 2)
        - (headerHeight / 2);

    }

    /*
      내용이 긴 섹션은
      제목이 헤더 아래에서 시작
    */
    else {

      targetPosition =
        target.offsetTop
        - headerHeight
        - 20;

    }


    window.scrollTo({

      top: targetPosition,

      behavior: "smooth"

    });

  });

});

// 반짝이는 별 생성
const starfield = document.getElementById("starfield");
const starCount = 260;

for (let i = 0; i < starCount; i++) {
  const star = document.createElement("span");
  star.classList.add("star");

  const size = Math.random() * 3 + 1;
  const posX = Math.random() * 100;
  const posY = Math.random() * 100;
  const delay = Math.random() * 6;
  const duration = Math.random() * 4 + 3;
  const opacity = Math.random() * 0.7 + 0.2;

  star.style.width = `${size}px`;
  star.style.height = `${size}px`;
  star.style.left = `${posX}%`;
  star.style.top = `${posY}%`;
  star.style.animationDelay = `${delay}s`;
  star.style.animationDuration = `${duration}s`;
  star.style.opacity = opacity;

  starfield.appendChild(star);
}
// 스크롤 시 섹션 페이드 인
const fadeSections = document.querySelectorAll(
  ".section, .hero"
);

fadeSections.forEach((section) => {
  section.classList.add("fade-section");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

fadeSections.forEach((section) => {
  observer.observe(section);
});

// 첫 화면은 바로 표시
document.querySelector(".hero")?.classList.add("show");

// ======================================================
// FEATURED PROJECTS - SCROLL REVEAL
// ======================================================

const projectCards =
  document.querySelectorAll(".project-card");

const projectObserver =
  new IntersectionObserver(
    (entries, observer) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          entry.target.classList.add("show");

          observer.unobserve(entry.target);

        }

      });

    },
    {
      threshold: 0.18
    }
  );

projectCards.forEach((card) => {
  projectObserver.observe(card);
});

// ======================================================
// SMOOTH SECTION FADE IN / FADE OUT
// ======================================================

// 페이드용 오버레이 자동 생성
const pageFadeOverlay = document.createElement("div");

pageFadeOverlay.className = "page-fade-overlay";

document.body.appendChild(pageFadeOverlay);


// 페이지 안의 #링크들에 페이드 전환 적용
document
  .querySelectorAll('a[href^="#"]')
  .forEach((link) => {

    link.addEventListener("click", (event) => {

      const targetId =
        link.getAttribute("href");


      // #만 있는 링크는 제외
      if (
        !targetId ||
        targetId === "#"
      ) {
        return;
      }


      const target =
        document.querySelector(targetId);


      if (!target) {
        return;
      }


      event.preventDefault();


      // 모바일 메뉴가 열려 있으면 닫기
      if (
        typeof siteNav !== "undefined" &&
        siteNav
      ) {
        siteNav.classList.remove("active");
      }


      // 1단계
      // 현재 화면 천천히 Fade Out
      pageFadeOverlay.classList.add("active");


      setTimeout(() => {

        const header =
          document.querySelector(".site-header");

        const headerHeight =
          header
            ? header.offsetHeight
            : 0;


        /*
          HOME은 위로,
          나머지는 화면 중앙에 최대한 맞춤
        */

        if (targetId === "#home") {

          window.scrollTo({
            top: 0,
            behavior: "auto"
          });

        } else {

          const targetRect =
            target.getBoundingClientRect();

          const absoluteTop =
            window.scrollY +
            targetRect.top;

          const viewportHeight =
            window.innerHeight;

          const targetHeight =
            target.offsetHeight;


          let scrollPosition;


          /*
            섹션이 화면보다 작다면
            정확히 화면 중앙 배치
          */
          if (
            targetHeight <
            viewportHeight - headerHeight
          ) {

            scrollPosition =
              absoluteTop
              -
              (
                viewportHeight
                - targetHeight
              ) / 2
              -
              headerHeight / 2;

          }

          /*
            섹션이 긴 경우
            제목이 헤더 아래에서 시작
          */
          else {

            scrollPosition =
              absoluteTop
              - headerHeight
              - 20;

          }


          window.scrollTo({
            top: Math.max(
              0,
              scrollPosition
            ),
            behavior: "auto"
          });

        }


        /*
          아주 짧게 기다렸다가
          새 섹션 Fade In
        */
        setTimeout(() => {

          pageFadeOverlay
            .classList
            .remove("active");

        }, 180);


      }, 1400);

    });

  });
