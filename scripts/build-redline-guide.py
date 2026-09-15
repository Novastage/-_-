from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".redline-guide-work"
WORK.mkdir(exist_ok=True)
OUT = ROOT / "redline" / "NOVA_RED_LINE_ONLINE_MASTERING_GUIDE.pdf"
SITE = os.environ.get("REDLINE_GUIDE_URL", "https://www.nsenter.co.kr/redline/")

W, H = A4
M = 34
RED = HexColor("#e9213d")
DARK = HexColor("#171717")
TEXT = HexColor("#202124")
MUTED = HexColor("#666a70")
LIGHT = HexColor("#f3f4f6")
LINE = HexColor("#dadce0")


def find_font(name: str) -> str:
    candidates = [
        f"/usr/share/fonts/truetype/nanum/{name}.ttf",
        f"/usr/share/fonts/truetype/nanum/{name}.otf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"Nanum font not found: {name}")


pdfmetrics.registerFont(TTFont("NSR", find_font("NanumSquareR")))
pdfmetrics.registerFont(TTFont("NSB", find_font("NanumSquareB")))


def wrap(text: str, font: str, size: float, maxw: float) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for word in words:
        candidate = word if not cur else cur + " " + word
        if stringWidth(candidate, font, size) <= maxw:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def trim_image(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    # Only remove truly flat near-white browser margins. Dark RED LINE UI is preserved.
    px = im.load()
    xs, ys = [], []
    for y in range(0, im.height, max(1, im.height // 160)):
        for x in range(0, im.width, max(1, im.width // 200)):
            r, g, b = px[x, y]
            if min(r, g, b) < 245:
                xs.append(x)
                ys.append(y)
    if xs and ys:
        pad = 8
        box = (
            max(0, min(xs) - pad),
            max(0, min(ys) - pad),
            min(im.width, max(xs) + pad),
            min(im.height, max(ys) + pad),
        )
        if box[2] - box[0] > im.width * 0.45:
            im = im.crop(box)
    im.save(path, optimize=True)


async def screenshot_section(page, keyword: str, filename: str, scope: str | None = None) -> Path | None:
    root = page.locator(scope) if scope else page.locator("body")
    candidates = [
        root.locator("section").filter(has_text=keyword).first,
        root.locator(".card").filter(has_text=keyword).first,
    ]
    for loc in candidates:
        try:
            if await loc.count() and await loc.is_visible():
                await loc.scroll_into_view_if_needed()
                await page.wait_for_timeout(250)
                out = WORK / filename
                await loc.screenshot(path=str(out), animations="disabled")
                trim_image(out)
                return out
        except Exception:
            pass
    return None


async def capture_ui() -> dict[str, Path | None]:
    shots: dict[str, Path | None] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1500, "height": 1050},
            device_scale_factor=2,
            locale="ko-KR",
        )
        page = await context.new_page()
        await page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
        await page.wait_for_selector(".onlineModuleTab", timeout=90000)
        await page.wait_for_timeout(3500)
        await page.evaluate("window.scrollTo(0,0)")
        await page.wait_for_timeout(300)
        shots["cover"] = WORK / "cover.png"
        await page.screenshot(path=str(shots["cover"]), full_page=False, animations="disabled")

        # MASTER sections.
        for key, keyword in [
            ("master_source", "소스 파일 / Source"),
            ("master_preview", "Original / Master Preview"),
            ("master_loudness", "LUFS / Loudness"),
            ("master_character", "GENRE / CHARACTER"),
            ("master_monitor", "PRE-MASTER LIVE MONITOR"),
            ("master_auto", "AUTO MASTER"),
            ("master_final", "Final Export"),
        ]:
            shots[key] = await screenshot_section(page, keyword, f"{key}.png")

        async def select_tab(label: str, workspace: str):
            tab = page.locator(".onlineModuleTab").filter(has_text=label).first
            await tab.scroll_into_view_if_needed()
            await tab.click(force=True)
            await page.locator(workspace).wait_for(state="visible", timeout=30000)
            await page.wait_for_timeout(800)

        await select_tab("STEM", "#stemWorkspace")
        shots["stem_source"] = await screenshot_section(page, "SOURCE", "stem_source.png", "#stemWorkspace")
        shots["stem_preview"] = await screenshot_section(page, "VOCAL / MR PREVIEW", "stem_preview.png", "#stemWorkspace")
        if not shots["stem_preview"]:
            shots["stem_preview"] = await screenshot_section(page, "STEM PREVIEW", "stem_preview.png", "#stemWorkspace")

        await select_tab("VOICE CLEAN", "#voiceWorkspace")
        shots["voice_source"] = await screenshot_section(page, "CLEAN SOURCE", "voice_source.png", "#voiceWorkspace")
        shots["voice_preview"] = await screenshot_section(page, "ORIGINAL / CLEAN", "voice_preview.png", "#voiceWorkspace")

        await select_tab("AI RESTORE", "#restoreWorkspace")
        shots["restore_source"] = await screenshot_section(page, "RESTORE SOURCE", "restore_source.png", "#restoreWorkspace")
        shots["restore_preview"] = await screenshot_section(page, "ORIGINAL / RESTORED", "restore_preview.png", "#restoreWorkspace")

        await browser.close()
    return shots


def build_pdf(shots: dict[str, Path | None]) -> None:
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("NOVA RED LINE ONLINE USER GUIDE V1.0")
    c.setAuthor("Nova Stage")

    def header(title: str, kicker: str = ""):
        c.setFillColor(DARK)
        c.rect(0, H - 54, W, 54, fill=1, stroke=0)
        c.setFillColor(RED)
        c.rect(0, H - 54, 7, 54, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("NSB", 18)
        c.drawString(M, H - 36, title)
        if kicker:
            c.setFillColor(HexColor("#c8cbd0"))
            c.setFont("NSR", 8.5)
            c.drawRightString(W - M, H - 35, kicker)

    def footer(n: int):
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(M, 26, W - M, 26)
        c.setFillColor(MUTED)
        c.setFont("NSR", 7.5)
        c.drawString(M, 14, "NOVA RED LINE · ONLINE USER GUIDE")
        c.drawRightString(W - M, 14, f"{n:02d}")

    def item(num: int, head: str, body: str, x: float, y: float, width: float, size: float = 9.4) -> float:
        c.setFillColor(RED)
        c.circle(x + 10, y - 9, 10, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("NSB", 8.7)
        c.drawCentredString(x + 10, y - 12, str(num))
        tx = x + 29
        c.setFillColor(TEXT)
        c.setFont("NSB", 10.5)
        c.drawString(tx, y - 7, head)
        lines = wrap(body, "NSR", size, width - (tx - x))
        yy = y - 24
        c.setFillColor(HexColor("#4b4f55"))
        c.setFont("NSR", size)
        for line in lines:
            c.drawString(tx, yy, line)
            yy -= 14
        return yy - 7

    def image_box(path: Path | None, top: float, maxh: float, label: int | None = None, width: float | None = None) -> float:
        if not path or not path.exists():
            return top
        width = width or (W - 2 * M)
        im = Image.open(path)
        h = width * im.height / im.width
        if h > maxh:
            h = maxh
            width = h * im.width / im.height
        x = (W - width) / 2
        c.setFillColor(HexColor("#f7f7f8"))
        c.setStrokeColor(HexColor("#d8dadd"))
        c.roundRect(x - 5, top - h - 5, width + 10, h + 10, 8, fill=1, stroke=1)
        c.drawImage(ImageReader(str(path)), x, top - h, width=width, height=h, preserveAspectRatio=True, mask="auto")
        if label is not None:
            c.setFillColor(RED)
            c.circle(x + 11, top - 11, 10, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("NSB", 8.5)
            c.drawCentredString(x + 11, top - 14, str(label))
        return top - h - 10

    def note(title: str, body: str, top: float) -> float:
        lines = wrap(body, "NSR", 9.2, W - 2 * M - 28)
        hh = 30 + 14 * len(lines)
        c.setFillColor(HexColor("#fff3f5"))
        c.setStrokeColor(HexColor("#f0a7b1"))
        c.roundRect(M, top - hh, W - 2 * M, hh, 8, fill=1, stroke=1)
        c.setFillColor(RED)
        c.setFont("NSB", 9.5)
        c.drawString(M + 13, top - 17, title)
        c.setFillColor(HexColor("#4a3a3d"))
        c.setFont("NSR", 9.2)
        yy = top - 34
        for line in lines:
            c.drawString(M + 13, yy, line)
            yy -= 14
        return top - hh

    # 01 Cover
    c.setFillColor(DARK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(RED)
    c.rect(0, 0, 9, H, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("NSB", 30)
    c.drawString(48, H - 115, "NOVA RED LINE")
    c.setFillColor(HexColor("#ff5369"))
    c.setFont("NSB", 17)
    c.drawString(48, H - 146, "ONLINE USER GUIDE")
    c.setFillColor(HexColor("#c6c8cc"))
    c.setFont("NSR", 10)
    c.drawString(48, H - 170, "MASTER · STEM · VOICE CLEAN · AI RESTORE")
    cover = shots.get("cover")
    if cover and cover.exists():
        im = Image.open(cover)
        iw = W - 96
        ih = min(340, iw * im.height / im.width)
        c.drawImage(ImageReader(str(cover)), 48, H - 210 - ih, width=iw, height=ih, preserveAspectRatio=True, anchor="c", mask="auto")
    c.setFillColor(HexColor("#efeff1"))
    c.setFont("NSR", 10)
    c.drawString(48, 102, "무료 이용: 처리 가능 · 전체 길이 청취 가능")
    c.setFillColor(HexColor("#ff5369"))
    c.setFont("NSB", 10)
    c.drawString(48, 82, "WAV 다운로드: 정기구독 후 이용")
    c.setFillColor(HexColor("#a7abb1"))
    c.setFont("NSR", 8.5)
    c.drawString(48, 48, "V1.0 · Current Online Interface Edition")
    c.showPage()

    # 02 Start
    header("시작하기", "01-04 · 공통 사용법")
    y = H - 82
    y = item(1, "서비스 개요", "NOVA RED LINE은 웹브라우저에서 마스터링, 보컬/MR 분리, 보컬 정리, AI 음원 복원을 수행하는 온라인 오디오 도구입니다.", M, y, W - 2 * M)
    y = item(2, "무료 이용과 정기구독", "무료 사용자도 각 기능을 실행하고 처리 결과를 전체 길이로 청취할 수 있습니다. 최종 WAV 파일 다운로드만 정기구독이 필요합니다.", M, y, W - 2 * M)
    y = item(3, "상단 메뉴", "MASTER, STEM, VOICE CLEAN, AI RESTORE 중 원하는 기능을 선택합니다. 선택된 메뉴는 RED 컬러로 표시됩니다.", M, y, W - 2 * M)
    y = item(4, "공통 작업 순서", "파일 선택 → 설정 조정 → 처리 버튼 실행 → Original/Result 비교 청취 → WAV 다운로드 순서로 사용합니다.", M, y, W - 2 * M)
    note("중요", "정기구독 팝업은 처리 버튼이 아니라 WAV 다운로드를 선택했을 때 표시됩니다.", y - 4)
    footer(2)
    c.showPage()

    # 03 Master source / preview
    header("MASTER · 소스와 비교 청취", "05-07")
    y = H - 78
    y = image_box(shots.get("master_source"), y, 205, 5)
    y -= 10
    y = image_box(shots.get("master_preview"), y, 205, 6)
    y -= 10
    y = item(5, "MASTER SOURCE / REFERENCE", "MASTER SOURCE에서 마스터링할 음원을 선택합니다. REFERENCE는 선택 사항이며 비교 기준이 필요한 경우에만 불러옵니다.", M, y, W - 2 * M)
    y = item(6, "Original / Master Preview", "ORIGINAL은 원본, MASTER PREVIEW는 처리 결과입니다. 위치 맞추기 버튼으로 같은 구간을 빠르게 A/B 비교할 수 있습니다.", M, y, W - 2 * M)
    footer(3)
    c.showPage()

    # 04 Loudness / character / monitor
    header("MASTER · 음색과 라이브 조절", "07-09")
    y = H - 78
    y = image_box(shots.get("master_loudness"), y, 230, 7)
    y -= 10
    secondary = shots.get("master_character") or shots.get("master_monitor")
    y = image_box(secondary, y, 230, 8)
    y -= 10
    y = item(7, "LUFS / Loudness", "SOURCE LUFS-I, TARGET LUFS-I, FINAL MASTER LUFS-I를 확인합니다. 처음에는 Streaming Safe -14 LUFS / -1 dBTP부터 시작하는 것이 무난합니다.", M, y, W - 2 * M)
    y = item(8, "Genre / Character", "AUTO DETECT를 사용하거나 장르와 캐릭터를 직접 선택해 마스터링 성향을 정합니다. 기본값에서 작은 폭으로 조정하는 것을 권장합니다.", M, y, W - 2 * M)
    footer(4)
    c.showPage()

    # 05 Auto / manual
    header("MASTER · 분석 / 자동 / 수동 마스터링", "10-12")
    y = H - 78
    y = image_box(shots.get("master_auto"), y, 235, 11)
    y -= 10
    y = image_box(shots.get("master_final"), y, 225, 12)
    y -= 10
    y = item(10, "SOURCE ANALYZE", "원본 파일을 선택한 뒤 SOURCE ANALYZE를 누르면 Sample Rate, Peak, True Peak, Crest, Stereo 상태 등을 확인할 수 있습니다.", M, y, W - 2 * M)
    y = item(11, "AUTO MASTER · ONE CLICK", "자동 마스터링을 원하면 AUTO MASTER · ONE CLICK을 누릅니다. 분석 → 설정 → 렌더 → 검사 → Final 순서로 자동 처리됩니다.", M, y, W - 2 * M)
    y = item(12, "수동 마스터링 / Final Export", "Genre, Character, Volume, Delay, Echo, Reverb 등 원하는 값을 조절한 뒤 마스터링을 실행합니다. 처리 버튼은 무료 사용자도 사용할 수 있습니다.", M, y, W - 2 * M)
    footer(5)
    c.showPage()

    # 06 Download policy
    header("MASTER · 결과 확인과 다운로드", "18 · 공통 다운로드 정책")
    y = H - 80
    y = image_box(shots.get("master_final"), y, 310, 18)
    y -= 18
    y = item(18, "WAV 다운로드", "마스터링이 완료되면 결과를 전체 길이로 청취할 수 있습니다. WAV 다운로드를 선택하면 무료 사용자는 정기구독 안내 팝업이 표시됩니다.", M, y, W - 2 * M)
    y = item(18, "무료 사용자의 동작", "마스터링 실행 자체에는 구독 팝업이 뜨지 않습니다. 처리 완료 → 결과 전체 청취 → 다운로드 선택의 순서로 사용합니다.", M, y, W - 2 * M)
    note("추천 확인 포인트", "원본보다 음량만 커졌는지보다 저역의 정리, 보컬 위치, 고역의 자극감, 스테레오 안정성, True Peak를 함께 비교하세요.", y - 5)
    footer(6)
    c.showPage()

    # 07 STEM
    header("STEM · VOCAL / MR 분리", "13-14")
    y = H - 78
    y = image_box(shots.get("stem_source"), y, 250, 13)
    y -= 10
    y = image_box(shots.get("stem_preview"), y, 245, 14)
    y -= 10
    y = item(13, "파일 선택과 분리 시작", "음원 파일을 선택한 뒤 AI VOCAL / MR 분리 시작을 누릅니다. 결과는 VOCAL과 MR / INSTRUMENTAL 두 트랙으로 생성됩니다.", M, y, W - 2 * M)
    y = item(14, "결과 청취와 다운로드", "VOCAL과 MR은 각각 전체 길이로 청취할 수 있습니다. WAV 다운로드는 정기구독 사용자에게 제공됩니다.", M, y, W - 2 * M)
    footer(7)
    c.showPage()

    # 08 Voice settings
    header("VOICE CLEAN · 기본 설정", "14")
    y = H - 78
    y = image_box(shots.get("voice_source"), y, 430, 14)
    y -= 12
    y = item(14, "보컬 / Stem 파일과 프리셋", "보컬 또는 Stem 파일을 선택하고 CLEAN PRESET을 고릅니다. 처음에는 VOCAL · 균형 정리 프리셋을 권장합니다.", M, y, W - 2 * M)
    y = item(14, "5가지 보정 항목", "NOISE는 바닥 잡음, ROOM TAIL은 잔향 꼬리, DE-ESS는 치찰음, BODY는 보컬의 두께, CLARITY는 명료도를 조절합니다.", M, y, W - 2 * M)
    note("조절 원칙", "한 번에 큰 폭으로 올리기보다 기본값에서 조금씩 변경하면서 ORIGINAL과 CLEAN을 비교하는 편이 자연스럽습니다.", y - 5)
    footer(8)
    c.showPage()

    # 09 Voice result
    header("VOICE CLEAN · 처리와 결과 비교", "15 · 18")
    y = H - 78
    y = image_box(shots.get("voice_preview"), y, 385, 15)
    y -= 12
    y = item(15, "VOICE CLEAN 처리", "설정이 끝나면 VOICE CLEAN 처리를 누릅니다. 처리 후 ORIGINAL과 CLEAN RESULT 플레이어에서 같은 구간을 비교합니다.", M, y, W - 2 * M)
    y = item(15, "위치 맞추기", "Original → Clean 또는 Clean → Original 버튼으로 재생 위치를 맞추면 미세한 차이를 빠르게 확인할 수 있습니다.", M, y, W - 2 * M)
    y = item(18, "WAV 다운로드", "무료 사용자는 CLEAN RESULT 전체 길이를 청취할 수 있으며, WAV 다운로드를 누르면 정기구독 안내 팝업이 표시됩니다.", M, y, W - 2 * M)
    footer(9)
    c.showPage()

    # 10 Restore settings
    header("AI RESTORE · 기본 설정", "16")
    y = H - 78
    y = image_box(shots.get("restore_source"), y, 430, 16)
    y -= 12
    y = item(16, "AI 음원 / Stem 파일과 프리셋", "AI 생성 음원 또는 복원이 필요한 Stem 파일을 선택하고 RESTORE PRESET을 고릅니다. 기본값은 AI FULL MIX · 균형 복구입니다.", M, y, W - 2 * M)
    y = item(16, "5가지 복원 항목", "SMEAR는 흐려진 윤곽, TAIL은 잔향 꼬리, MID MASK는 중역 겹침, TRANSIENT는 어택, STEREO는 좌우 이미지 안정성을 보정합니다.", M, y, W - 2 * M)
    note("기능 성격", "AI RESTORE는 소리를 완전히 바꾸는 효과가 아니라 원본의 문제를 자연스럽게 정돈하는 복원 기능입니다.", y - 5)
    footer(10)
    c.showPage()

    # 11 Restore result
    header("AI RESTORE · 처리와 결과 비교", "17 · 18")
    y = H - 78
    y = image_box(shots.get("restore_preview"), y, 385, 17)
    y -= 12
    y = item(17, "AI RESTORE 처리", "설정을 마친 뒤 AI RESTORE 처리를 누릅니다. 처리 후 ORIGINAL과 RESTORED RESULT를 전체 길이로 비교합니다.", M, y, W - 2 * M)
    y = item(17, "비교 청취 포인트", "중역의 답답함, 잔향 꼬리, 킥/스네어 어택, 스테레오 중심의 흔들림이 줄었는지 확인합니다. 변화가 과하면 강도를 낮춥니다.", M, y, W - 2 * M)
    y = item(18, "WAV 다운로드", "RESTORED RESULT는 무료 사용자도 전체 청취할 수 있습니다. WAV 다운로드 선택 시 정기구독 안내가 표시됩니다.", M, y, W - 2 * M)
    footer(11)
    c.showPage()

    # 12 Summary
    header("빠른 사용 요약 / 문제 해결", "18")
    y = H - 86
    flows = [
        ("MASTER", "파일 선택 → SOURCE ANALYZE → AUTO 또는 수동 MASTER → A/B 비교 → WAV 다운로드"),
        ("STEM", "파일 선택 → AI VOCAL / MR 분리 시작 → VOCAL / MR 청취 → WAV 다운로드"),
        ("VOICE CLEAN", "파일 선택 → 프리셋/보정값 조절 → VOICE CLEAN 처리 → ORIGINAL / CLEAN 비교 → WAV 다운로드"),
        ("AI RESTORE", "파일 선택 → 프리셋/복원값 조절 → AI RESTORE 처리 → ORIGINAL / RESTORED 비교 → WAV 다운로드"),
    ]
    for name, body in flows:
        c.setFillColor(LIGHT)
        c.setStrokeColor(LINE)
        c.roundRect(M, y - 62, W - 2 * M, 54, 8, fill=1, stroke=1)
        c.setFillColor(RED)
        c.setFont("NSB", 11)
        c.drawString(M + 14, y - 28, name)
        lines = wrap(body, "NSR", 9.2, W - 2 * M - 100)
        c.setFillColor(TEXT)
        c.setFont("NSR", 9.2)
        yy = y - 28
        for line in lines:
            c.drawString(M + 100, yy, line)
            yy -= 13
        y -= 68
    y -= 10
    c.setFillColor(TEXT)
    c.setFont("NSB", 12)
    c.drawString(M, y, "문제가 있을 때")
    y -= 22
    troubles = [
        "파일이 선택되지 않으면 WAV, MP3, FLAC, AIFF 등 일반 오디오 형식으로 다시 시도합니다.",
        "처리 버튼이 반응하지 않으면 페이지를 새로고침한 뒤 파일을 다시 선택합니다.",
        "결과 비교 시 같은 재생 위치를 맞춘 뒤 볼륨 차이뿐 아니라 질감과 스테레오도 함께 확인합니다.",
        "최신 Chrome 또는 Edge 브라우저 사용을 권장합니다.",
    ]
    for t in troubles:
        c.setFillColor(RED)
        c.circle(M + 6, y - 3, 3, fill=1, stroke=0)
        lines = wrap(t, "NSR", 9.4, W - 2 * M - 20)
        c.setFillColor(HexColor("#4b4f55"))
        c.setFont("NSR", 9.4)
        for line in lines:
            c.drawString(M + 18, y, line)
            y -= 14
        y -= 4
    note("최종 이용 정책", "FREE = 처리 가능 + 전체 길이 청취 가능. SUBSCRIBED = 전체 길이 청취 + WAV 다운로드 가능.", y - 8)
    footer(12)
    c.showPage()

    c.save()


async def main() -> None:
    shots = await capture_ui()
    build_pdf(shots)
    print(f"Generated: {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
