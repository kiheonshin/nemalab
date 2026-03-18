from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

SITE_URL = "https://nemalab.vercel.app"
TITLE = "Nema Lab"
TAGLINE = "예쁜꼬마선충 행동·뉴런 시뮬레이터"
DESCRIPTION = "환경 시뮬레이션, 뉴런 지도, 트래킹 뷰를 실시간으로 연결해 예쁜꼬마선충의 감각-행동 반응을 탐색하는 인터랙티브 실험실."

BG_TOP = "#0b1119"
BG_BOTTOM = "#131f2f"
PANEL = (18, 26, 38, 232)
PANEL_BORDER = (152, 180, 221, 42)
TEXT = "#eef3ff"
TEXT_DIM = "#b8c5de"
TEXT_FAINT = "#7d8ba5"
ACCENT = "#7de2cf"
ACCENT_2 = "#9cb8ff"
AMBER = "#f3bd4f"
CORAL = "#ff9a9a"
GRID = (162, 178, 208, 18)


def hex_rgba(value: str, alpha: int) -> tuple[int, int, int, int]:
    rgb = ImageColor.getrgb(value)
    return rgb[0], rgb[1], rgb[2], alpha


def pick_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates += [
            "C:/Windows/Fonts/seguisb.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    candidates += [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
    ]

    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)

    return ImageFont.load_default()


def draw_vertical_gradient(image: Image.Image, top: str, bottom: str) -> None:
    top_rgb = ImageColor.getrgb(top)
    bottom_rgb = ImageColor.getrgb(bottom)
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(int(top_rgb[i] + (bottom_rgb[i] - top_rgb[i]) * t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)


def add_glow(base: Image.Image, bbox: tuple[int, int, int, int], color: str, alpha: int, blur: int) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse(bbox, fill=hex_rgba(color, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(overlay)


def rounded_panel(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    *,
    radius: int = 28,
    fill: tuple[int, int, int, int] = PANEL,
    outline: tuple[int, int, int, int] = PANEL_BORDER,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_grid(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], step: int = 26) -> None:
    x1, y1, x2, y2 = xy
    for x in range(x1, x2 + 1, step):
        draw.line((x, y1, x, y2), fill=GRID, width=1)
    for y in range(y1, y2 + 1, step):
        draw.line((x1, y, x2, y), fill=GRID, width=1)


def draw_worm(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    *,
    color: str = ACCENT,
    width: int = 18,
    head_radius: int = 14,
) -> None:
    pts = list(points)
    if len(pts) < 2:
        return
    draw.line(pts, fill=hex_rgba(color, 230), width=width, joint="curve")
    hx, hy = pts[-1]
    draw.ellipse((hx - head_radius, hy - head_radius, hx + head_radius, hy + head_radius), fill=hex_rgba("#f5f9ff", 240))
    draw.ellipse((hx - head_radius // 2, hy - head_radius // 2, hx + head_radius // 2, hy + head_radius // 2), fill=hex_rgba("#ffffff", 210))


def draw_tapered_worm(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    *,
    color: str = ACCENT,
    tail_radius: float = 6,
    head_radius: float = 18,
) -> None:
    pts = list(points)
    if len(pts) < 2:
        return

    for idx in range(len(pts) - 1):
        x1, y1 = pts[idx]
        x2, y2 = pts[idx + 1]
        dx = x2 - x1
        dy = y2 - y1
        distance = max(abs(dx), abs(dy))
        steps = max(8, int(distance / 6))

        for step in range(steps + 1):
            local_t = step / steps
            global_t = (idx + local_t) / max(1, len(pts) - 1)
            radius = tail_radius + (head_radius - tail_radius) * (global_t ** 1.28)
            x = x1 + dx * local_t
            y = y1 + dy * local_t
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=hex_rgba(color, 232),
            )

    hx, hy = pts[-1]
    draw.ellipse(
        (hx - head_radius, hy - head_radius, hx + head_radius, hy + head_radius),
        fill=hex_rgba("#f5f9ff", 240),
    )
    draw.ellipse(
        (hx - head_radius * 0.55, hy - head_radius * 0.55, hx + head_radius * 0.55, hy + head_radius * 0.55),
        fill=hex_rgba("#ffffff", 210),
    )


def draw_simulator_worm(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    *,
    color: str = ACCENT,
    width: int = 20,
    head_radius: int = 18,
) -> None:
    pts = list(points)
    if len(pts) < 2:
        return

    line_fill = hex_rgba(color, 232)
    draw.line(pts, fill=line_fill, width=width, joint="curve")

    tx, ty = pts[0]
    tail_radius = width / 2
    draw.ellipse(
        (tx - tail_radius, ty - tail_radius, tx + tail_radius, ty + tail_radius),
        fill=line_fill,
    )

    hx, hy = pts[-1]
    draw.ellipse(
        (hx - head_radius, hy - head_radius, hx + head_radius, hy + head_radius),
        fill=hex_rgba("#f5f9ff", 240),
    )
    draw.ellipse(
        (hx - head_radius * 0.55, hy - head_radius * 0.55, hx + head_radius * 0.55, hy + head_radius * 0.55),
        fill=hex_rgba("#ffffff", 210),
    )


def draw_environment_card(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], title_font, body_font) -> None:
    rounded_panel(draw, rect, radius=30)
    x1, y1, x2, y2 = rect
    inset = 24
    arena = (x1 + inset, y1 + 66, x2 - inset, y2 - inset)
    draw_grid(draw, arena, step=32)
    draw.rounded_rectangle(arena, radius=24, fill=(9, 15, 24, 190), outline=(146, 168, 204, 30), width=1)

    food = (arena[2] - 210, arena[1] + 70, arena[2] - 20, arena[1] + 260)
    draw.ellipse(food, fill=hex_rgba("#6de2a0", 52), outline=hex_rgba("#7de2cf", 110), width=4)

    for ox, oy, r in [(arena[0] + 80, arena[1] + 170, 22), (arena[0] + 160, arena[1] + 340, 30), (arena[0] + 310, arena[1] + 300, 24)]:
        draw.ellipse((ox - r, oy - r, ox + r, oy + r), fill=(34, 43, 58, 180), outline=(90, 109, 135, 80), width=1)

    worm_points = [
        (arena[0] + 140, arena[1] + 360),
        (arena[0] + 175, arena[1] + 320),
        (arena[0] + 210, arena[1] + 255),
        (arena[0] + 244, arena[1] + 210),
        (arena[0] + 290, arena[1] + 160),
        (arena[0] + 340, arena[1] + 135),
    ]
    draw_worm(draw, worm_points, width=20, head_radius=16)

    legend_y = y1 + 26
    labels = [("Simulator", ACCENT), ("Connectome", ACCENT_2), ("Synchrony", AMBER)]
    cursor_x = x1 + 24
    for label, color in labels:
        draw.ellipse((cursor_x, legend_y + 11, cursor_x + 9, legend_y + 20), fill=hex_rgba(color, 230))
        draw.text((cursor_x + 16, legend_y), label, font=body_font, fill=TEXT_DIM)
        cursor_x += 128 if label != "Connectome" else 142

    draw.text((x1 + 24, y1 + 22), "Real-time behavior arena", font=title_font, fill=TEXT)


def draw_neural_card(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], title_font, small_font) -> None:
    rounded_panel(draw, rect, radius=28)
    x1, y1, x2, y2 = rect
    draw.text((x1 + 20, y1 + 18), "Neural atlas", font=title_font, fill=TEXT)

    usable_width = (x2 - x1) - 40
    left_w = int(usable_width * 0.26)
    mid_w = int(usable_width * 0.5)
    right_w = usable_width - left_w - mid_w
    region_x1 = x1 + 18
    region_x2 = region_x1 + left_w
    region_x3 = region_x2 + mid_w
    regions = [
        (region_x1, y1 + 56, region_x2, y2 - 20, hex_rgba(ACCENT, 18), hex_rgba(ACCENT, 64)),
        (region_x2 + 2, y1 + 56, region_x3, y2 - 20, hex_rgba(ACCENT_2, 14), hex_rgba(ACCENT_2, 48)),
        (region_x3 + 2, y1 + 56, x2 - 20, y2 - 20, hex_rgba(AMBER, 12), hex_rgba(AMBER, 40)),
    ]
    for region in regions:
        draw.rounded_rectangle(region[:4], radius=22, fill=region[4], outline=region[5], width=1)

    nodes = [
        (x1 + 70, y1 + 110, 9, ACCENT),
        (x1 + 82, y1 + 156, 8, ACCENT),
        (x1 + 96, y1 + 208, 10, ACCENT_2),
        (x1 + 154, y1 + 174, 7, AMBER),
        (x1 + 210, y1 + 160, 8, ACCENT),
        (x1 + 254, y1 + 186, 9, ACCENT),
        (x1 + 315, y1 + 170, 8, ACCENT_2),
        (x1 + 418, y1 + 198, 11, CORAL),
        (x1 + 474, y1 + 152, 9, ACCENT_2),
    ]
    for sx, sy, tx, ty, color in [
        (x1 + 70, y1 + 110, x1 + 210, y1 + 160, ACCENT),
        (x1 + 82, y1 + 156, x1 + 254, y1 + 186, ACCENT_2),
        (x1 + 96, y1 + 208, x1 + 418, y1 + 198, CORAL),
        (x1 + 210, y1 + 160, x1 + 474, y1 + 152, ACCENT_2),
    ]:
        draw.line((sx, sy, tx, ty), fill=hex_rgba(color, 150), width=3)

    for x, y, r, color in nodes:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=hex_rgba(color, 225), outline=hex_rgba("#eef3ff", 210), width=2)

    draw.text((x1 + 24, y2 - 42), "sensory  ->  interneuron  ->  motor", font=small_font, fill=TEXT_FAINT)


def draw_tracking_card(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], title_font, small_font) -> None:
    rounded_panel(draw, rect, radius=28)
    x1, y1, x2, y2 = rect
    draw.text((x1 + 20, y1 + 18), "Tracking camera", font=title_font, fill=TEXT)
    arena = (x1 + 18, y1 + 58, x2 - 18, y2 - 18)
    draw.rounded_rectangle(arena, radius=24, fill=(9, 15, 24, 195), outline=(146, 168, 204, 26), width=1)
    draw.ellipse((arena[0] + 54, arena[1] + 32, arena[0] + 194, arena[1] + 172), fill=hex_rgba("#6de2a0", 44), outline=hex_rgba("#7de2cf", 106), width=4)
    worm_points = [
        (arena[0] + 108, arena[1] + 160),
        (arena[0] + 122, arena[1] + 136),
        (arena[0] + 142, arena[1] + 108),
        (arena[0] + 158, arena[1] + 86),
        (arena[0] + 166, arena[1] + 60),
    ]
    draw_worm(draw, worm_points, width=18, head_radius=15)
    draw.text((x1 + 20, y2 - 38), "same worm, same moment, focused view", font=small_font, fill=TEXT_FAINT)


def make_og_image() -> None:
    image = Image.new("RGBA", (1200, 630), BG_TOP)
    draw_vertical_gradient(image, BG_TOP, BG_BOTTOM)
    add_glow(image, (-80, -120, 520, 380), ACCENT, 54, 90)
    add_glow(image, (720, -40, 1280, 360), ACCENT_2, 34, 120)
    add_glow(image, (760, 280, 1320, 760), AMBER, 24, 140)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    title_font = pick_font(72, bold=True)
    subtitle_font = pick_font(24, bold=False)
    eyebrow_font = pick_font(20, bold=True)
    body_font = pick_font(18, bold=False)
    small_font = pick_font(16, bold=False)

    draw.rounded_rectangle((34, 34, 1166, 596), radius=34, fill=(12, 18, 28, 108), outline=(148, 176, 214, 24), width=1)

    draw.text((78, 78), "C. ELEGANS SENSORIMOTOR SIMULATOR", font=eyebrow_font, fill=TEXT_FAINT)
    draw.text((78, 112), TITLE, font=title_font, fill=TEXT)
    draw.text((78, 202), "Arena, connectome, and tracking views in one real-time lab.", font=subtitle_font, fill=TEXT_DIM)

    pills = ["Simulator", "Connectome", "Synchrony"]
    px = 78
    for pill, color in zip(pills, [ACCENT, ACCENT_2, AMBER]):
        tw = draw.textbbox((0, 0), pill, font=body_font)[2]
        draw.rounded_rectangle((px, 254, px + tw + 32, 292), radius=19, fill=(20, 27, 39, 176), outline=hex_rgba(color, 96), width=1)
        draw.text((px + 16, 264), pill, font=body_font, fill=color)
        px += tw + 46

    stage = (78, 344, 1122, 548)
    rounded_panel(draw, stage, radius=28, fill=(15, 22, 33, 190), outline=(148, 176, 214, 28))

    stage_inner = (stage[0] + 18, stage[1] + 18, stage[2] - 18, stage[3] - 18)
    draw.rounded_rectangle(stage_inner, radius=24, fill=(9, 15, 24, 180), outline=(146, 168, 204, 20), width=1)
    draw_grid(draw, stage_inner, step=34)

    # Food field and tracking context
    food = (stage_inner[2] - 240, stage_inner[1] + 26, stage_inner[2] - 36, stage_inner[1] + 230)
    draw.ellipse(food, fill=hex_rgba("#6de2a0", 42), outline=hex_rgba("#7de2cf", 112), width=4)

    # Minimal connectome nodes
    node_chain = [
        (stage_inner[0] + 480, stage_inner[1] + 102, ACCENT_2),
        (stage_inner[0] + 625, stage_inner[1] + 126, CORAL),
        (stage_inner[0] + 764, stage_inner[1] + 108, ACCENT_2),
        (stage_inner[0] + 886, stage_inner[1] + 132, AMBER),
    ]
    draw.line(
        [coord[:2] for coord in node_chain],
        fill=hex_rgba(ACCENT_2, 118),
        width=4,
        joint="curve",
    )
    for x, y, color in node_chain:
        draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill=hex_rgba(color, 230), outline=hex_rgba("#eef3ff", 220), width=2)

    # Worm path as the hero element
    worm_points = [
        (stage_inner[0] + 112, stage_inner[1] + 176),
        (stage_inner[0] + 134, stage_inner[1] + 164),
        (stage_inner[0] + 162, stage_inner[1] + 156),
        (stage_inner[0] + 194, stage_inner[1] + 150),
        (stage_inner[0] + 232, stage_inner[1] + 138),
        (stage_inner[0] + 274, stage_inner[1] + 120),
        (stage_inner[0] + 324, stage_inner[1] + 98),
        (stage_inner[0] + 378, stage_inner[1] + 72),
    ]
    draw_simulator_worm(draw, worm_points, width=20, head_radius=18)

    draw.text((stage[0] + 22, stage[1] + 18), "Live behavior workspace", font=body_font, fill=TEXT)
    footer = "One worm, one run, three synchronized perspectives."
    footer_box = draw.textbbox((0, 0), footer, font=small_font)
    footer_width = footer_box[2] - footer_box[0]
    draw.text((stage[2] - 22 - footer_width, stage[3] - 42), footer, font=small_font, fill=TEXT_FAINT)

    image.alpha_composite(overlay)
    image.save(PUBLIC / "og-image.png", optimize=True)


def make_icon_master() -> Image.Image:
    size = 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    bg = Image.new("RGBA", (size, size), BG_TOP)
    draw_vertical_gradient(bg, BG_TOP, "#102033")
    add_glow(bg, (40, 40, 560, 560), ACCENT, 66, 80)
    add_glow(bg, (380, 440, 1040, 1040), ACCENT_2, 40, 110)
    image.alpha_composite(bg)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((72, 72, 952, 952), radius=220, fill=(13, 19, 29, 220), outline=(154, 181, 220, 42), width=8)
    draw.ellipse((160, 162, 690, 692), fill=hex_rgba("#6de2a0", 42), outline=hex_rgba("#7de2cf", 128), width=12)
    draw_worm(
        draw,
        [
            (272, 736),
            (332, 664),
            (382, 566),
            (452, 490),
            (546, 414),
            (650, 350),
        ],
        width=78,
        head_radius=52,
    )
    draw.ellipse((744, 226, 824, 306), fill=hex_rgba(AMBER, 245))
    return image


def make_favicon_svg() -> None:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Nema Lab icon">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1119"/>
      <stop offset="100%" stop-color="#102033"/>
    </linearGradient>
    <linearGradient id="worm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{ACCENT}"/>
      <stop offset="100%" stop-color="{ACCENT_2}"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bg)"/>
  <circle cx="52" cy="52" r="28" fill="rgba(109,226,160,0.18)" stroke="rgba(125,226,207,0.45)" stroke-width="2"/>
  <path d="M36 90 C44 76, 50 66, 58 57 S75 39, 90 30" fill="none" stroke="url(#worm)" stroke-linecap="round" stroke-width="10"/>
  <circle cx="90" cy="30" r="7.5" fill="#f5f9ff"/>
  <circle cx="103" cy="22" r="5" fill="{AMBER}"/>
</svg>
"""
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")


def make_icon_set() -> None:
    master = make_icon_master()
    sizes = {
        "apple-touch-icon.png": 180,
        "favicon-32x32.png": 32,
        "favicon-16x16.png": 16,
        "android-chrome-192x192.png": 192,
        "android-chrome-512x512.png": 512,
    }
    for filename, size in sizes.items():
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(PUBLIC / filename, optimize=True)

    master.save(
        PUBLIC / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


def make_manifest() -> None:
    manifest = f"""{{
  "name": "{TITLE}",
  "short_name": "Nema Lab",
  "description": "{DESCRIPTION}",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b1119",
  "theme_color": "#0f1722",
  "icons": [
    {{
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }},
    {{
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }}
  ]
}}
"""
    (PUBLIC / "site.webmanifest").write_text(manifest, encoding="utf-8")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    make_og_image()
    make_icon_set()
    make_favicon_svg()
    make_manifest()
    print("Generated brand assets in public/")


if __name__ == "__main__":
    main()
