"""生成 Boss 刷新倒计时应用图标：深色圆角底 + 绿到红渐变环形表盘 + BOSS 字样"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def lerp_color(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def hue_to_rgb(h):
    """h: 0..120 (红->绿)"""
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(h / 360.0, 0.85, 0.95)
    return (round(r * 255), round(g * 255), round(b * 255))


def render(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad_ratio = 0.16 if maskable else 0.0
    pad = round(size * pad_ratio)
    # 圆角方形深底
    radius = round(size * (0.22 if not maskable else 0.10))
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(18, 18, 20, 255))
    # 内部淡淡的径向高光
    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    idr = ImageDraw.Draw(inner)
    cx = cy = size / 2
    idr.ellipse([cx - size * 0.42, cy - size * 0.46, cx + size * 0.42, cy + size * 0.34], fill=(255, 255, 255, 14))
    img.alpha_composite(inner)
    # 渐变圆环：从顶部偏左开始，顺时针 300°，色相 120(绿)->0(红)
    ring_cx = ring_cy = size / 2
    ring_r = size * (0.335 if maskable else 0.36)
    width = max(6, round(size * 0.075))
    bbox = [ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r]
    start = -210.0  # PIL 角度：0=3点钟方向，逆时针为正；用分段 arc 画
    sweep_total = 300.0
    segs = 72
    for i in range(segs):
        t0 = i / segs
        a0 = start + sweep_total * t0
        a1 = start + sweep_total * (i + 1) / segs + 0.6  # 轻微重叠避免缝隙
        hue = 120 * (1 - t0)
        d.arc(bbox, start=a0, end=a1, fill=hue_to_rgb(hue) + (255,), width=width)
    # 圆环端点圆头
    for t in (0.0, 1.0):
        ang = math.radians(start + sweep_total * t)
        ex = ring_cx + ring_r * math.cos(ang)
        ey = ring_cy + ring_r * math.sin(ang)
        r = width / 2
        d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=hue_to_rgb(120 * (1 - t)) + (255,))
    # 中心指针（指向红色末端方向，像倒计时快归零）
    needle_ang = math.radians(start + sweep_total * 0.985 + 180)  # 朝上，避开文字
    nx = ring_cx + (ring_r - width * 1.15) * math.cos(needle_ang)
    ny = ring_cy + (ring_r - width * 1.15) * math.sin(needle_ang)
    d.line([ring_cx, ring_cy, nx, ny], fill=(245, 245, 245, 255), width=max(4, round(size * 0.028)))
    hr = size * 0.035
    d.ellipse([ring_cx - hr, ring_cy - hr, ring_cx + hr, ring_cy + hr], fill=(245, 245, 245, 255))
    # 中心文字 BOSS
    font_paths = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/msyhbd.ttc"]
    font = None
    for fp in font_paths:
        try:
            font = ImageFont.truetype(fp, round(size * 0.15))
            break
        except OSError:
            continue
    if font:
        text = "BOSS"
        tb = d.textbbox((0, 0), text, font=font)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        ty = ring_cy - th / 2 - tb[1] + size * 0.115  # 稍向下避开指针
        d.text((ring_cx - tw / 2, ty), text, font=font, fill=(250, 250, 250, 235))
    return img


icon512 = render(512)
icon512.save(OUT / "icon-512.png")
render(512, maskable=True).save(OUT / "icon-512-maskable.png")
render(192).save(OUT / "icon-192.png")
render(180).save(OUT / "apple-touch-icon.png")
render(32).save(OUT / "favicon-32.png")
icon512.resize((48, 48), Image.LANCZOS).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("icons written to", OUT)
