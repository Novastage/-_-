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

if (window.innerWidth > 1024) {

  const fadeSections =
    document.querySelectorAll(
      ".section, .hero"
    );

  fadeSections.forEach((section) => {
    section.classList.add("fade-section");
  });

  const sectionObserver =
    new IntersectionObserver(
      (entries) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {
            entry.target.classList.add("show");
          }

        });

      },
      {
        threshold: 0.15
      }
    );

  fadeSections.forEach((section) => {
    sectionObserver.observe(section);
  });

  document
    .querySelector(".hero")
    ?.classList.add("show");

}


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

if (window.innerWidth > 1024) {

  const projectCards =
    document.querySelectorAll(
      ".project-card"
    );

  const projectObserver =
    new IntersectionObserver(
      (entries, observer) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add("show");

            observer.unobserve(
              entry.target
            );

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

}


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
