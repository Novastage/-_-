// 현재 연도 자동 표시
document.getElementById("currentYear").textContent = new Date().getFullYear();

// 모바일 메뉴 토글
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

menuToggle.addEventListener("click", () => {
  siteNav.classList.toggle("active");
});

// 메뉴 클릭 시 모바일 메뉴 닫기
document.querySelectorAll(".site-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("active");
  });
});

// 반짝이는 별 생성
const starfield = document.getElementById("starfield");
const starCount = 180;

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
