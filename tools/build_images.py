#!/usr/bin/env python3
"""
从 myPhotos/ 生成网站所需的 WebP 图片。

- 自动按 EXIF 方向摆正
- 将 Display P3 等广色域转成 sRGB，避免浏览器偏色
- 全部剥离 EXIF/GPS，保护隐私
- 统一裁切比例、轻微锐化、WebP 压缩
- 生成 OG 分享图与 favicon

用法：python3 tools/build_images.py
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageCms, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "myPhotos"
OUT = ROOT / "assets" / "images"
OUT.mkdir(parents=True, exist_ok=True)

SRGB = ImageCms.createProfile("sRGB")

# 文件名 -> 源文件（按 contact sheet 的编号）
FILES = {
    "01": "01f94bc901ac435d6d2e2bb52880bef6.jpg",
    "02": "372b76b5eee0f1131ece55865c39ce45.jpg",
    "03": "92bac8a908adf8cfd4cc034ebd5e2698.jpg",
    "04": "IMG_3099.jpeg",
    "05": "IMG_3116.jpeg",
    "06": "IMG_3287.jpeg",
    "07": "IMG_3295.jpeg",
    "08": "IMG_3841.jpeg",
    "09": "IMG_4031.jpeg",
    "10": "IMG_4040.jpeg",
    "11": "IMG_4056.jpeg",
    "12": "IMG_4138.jpeg",
    "13": "IMG_4219.jpeg",
    "14": "IMG_4246.jpeg",
    "15": "IMG_4299.jpeg",
    "16": "IMG_4429.jpeg",
    "17": "IMG_4595.jpeg",
    "18": "IMG_6484.jpeg",
    "19": "IMG_9907.jpeg",
    "20": "fxn 2025-05-03 175931.600.JPG",
    "21": "fxn 2025-05-03 175939.313 2.JPG",
    "22": "fxn 2025-05-03 175939.313.JPG",
    "23": "fxn 2025-05-03 180054.263.JPG",
}


def load(key: str) -> Image.Image:
    im = Image.open(SRC / FILES[key])
    # 必须先按 EXIF 摆正，再做色彩转换（色彩转换会丢掉 orientation 标记）
    im = ImageOps.exif_transpose(im)
    icc = im.info.get("icc_profile")
    if icc:
        try:
            src_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            desc = ImageCms.getProfileDescription(src_profile).strip().lower()
            if "srgb" not in desc:
                im = ImageCms.profileToProfile(
                    im, src_profile, SRGB, renderingIntent=0, outputMode="RGB"
                )
        except Exception:
            pass
    return im.convert("RGB")


def crop_ratio(im: Image.Image, ratio: float, anchor_y: float = 0.5) -> Image.Image:
    """按目标宽高比裁切；anchor_y 0=顶部 1=底部。"""
    w, h = im.size
    target_h = w / ratio
    if target_h <= h:
        top = int(round((h - target_h) * anchor_y))
        return im.crop((0, top, w, top + int(target_h)))
    target_w = h * ratio
    left = int(round((w - target_w) / 2))
    return im.crop((left, 0, left + int(target_w), h))


def finish(im: Image.Image, width: int, quality: int = 82) -> Image.Image:
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=0.7, percent=55, threshold=3))
    return im


def save_webp(im: Image.Image, name: str, quality: int = 82) -> None:
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.0f} KB  {im.width}x{im.height}")


def build() -> None:
    print("封面 / cover")
    cover_src = load("23")
    cover = finish(crop_ratio(cover_src, 9 / 16, 0.46), 1200, 84)
    save_webp(cover, "cover.webp", 84)
    save_webp(finish(crop_ratio(cover_src, 9 / 16, 0.46), 640), "cover-640.webp", 82)

    print("轮播 / carousel")
    carousel = [
        ("21", 0.50),
        ("03", 0.06),
        ("19", 0.50),
        ("02", 0.18),
        ("20", 0.50),
    ]
    for i, (key, ay) in enumerate(carousel, 1):
        im = finish(crop_ratio(load(key), 4 / 3, ay), 1200, 82)
        save_webp(im, f"carousel-{i}.webp", 82)

    print("照片墙 / story")
    # (key, 版式, anchor_y)
    story = [
        ("22", "wide", 0.50),
        ("07", "tall", 0.45),
        ("15", "tall", 0.50),
        ("06", "wide", 0.50),
        ("09", "tall", 0.42),
        ("10", "tall", 0.40),
        ("08", "wide", 0.42),
        ("17", "tall", 0.50),
        ("18", "tall", 0.42),
        ("05", "tall", 0.45),
        ("11", "tall", 0.45),
        ("12", "tall", 0.50),
        ("13", "tall", 0.42),
        ("14", "tall", 0.45),
        ("04", "tall", 0.40),
    ]
    for i, (key, kind, ay) in enumerate(story, 1):
        ratio = 3 / 2 if kind == "wide" else 3 / 4
        width = 1000 if kind == "wide" else 720
        im = finish(crop_ratio(load(key), ratio, ay), width, 80)
        save_webp(im, f"story-{i:02d}.webp", 80)

    print("头像 / avatars")
    groom = load("13")
    groom_sq = crop_square_at(groom, 0.43, 0.50, 0.48)
    save_webp(finish(groom_sq, 400, 84), "avatar-groom.webp", 84)

    bride = load("05")
    bride_sq = crop_square_at(bride, 0.367, 0.376, 0.46)
    save_webp(finish(bride_sq, 400, 84), "avatar-bride.webp", 84)

    print("OG 分享图 / open graph")
    build_og(load("23"))

    print("favicon")
    build_favicon()

    total = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())
    print(f"\n图片总体积：{total / 1024 / 1024:.2f} MB")


def crop_square_at(im: Image.Image, cx: float, cy: float, size: float) -> Image.Image:
    """以相对坐标为中心裁正方形，size 为相对短边的比例。"""
    w, h = im.size
    side = int(min(w, h) * size)
    left = int(w * cx - side / 2)
    top = int(h * cy - side / 2)
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))
    return im.crop((left, top, left + side, top + side))


def build_og(cover_src: Image.Image) -> None:
    """左侧纸面文字 + 右侧照片的分栏分享卡，避免文字压脸。"""
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), "#F8F6F1")
    photo = crop_ratio(cover_src, 600 / 630, 0.46).resize((600, 630), Image.LANCZOS)
    photo = ImageEnhance.Brightness(photo).enhance(0.95)
    canvas.paste(photo, (600, 0))

    d = ImageDraw.Draw(canvas)
    d.rectangle((597, 0, 600, H), fill="#E89C3C")

    serif = "/System/Library/Fonts/Supplemental/Bodoni 72.ttc"
    sans = "/System/Library/Fonts/PingFang.ttc"

    def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
        try:
            return ImageFont.truetype(path, size, index=index)
        except Exception:
            return ImageFont.load_default()

    ink = "#2F2B25"
    ink2 = "#5C564C"
    gold = "#B0782C"

    d.text((76, 92), "WEDDING INVITATION", font=font(serif, 18), fill=gold)
    d.text((74, 164), "欢迎参加", font=font(sans, 62, 5), fill=ink)
    d.text((74, 246), "我们的婚礼", font=font(sans, 62, 5), fill=ink)
    d.line([(78, 356), (198, 356)], fill="#E89C3C", width=3)
    d.text((76, 392), "2027.01.23  ·  12:00", font=font(serif, 28), fill=ink)
    d.text((78, 446), "中国 · 湖北 · 武穴", font=font(sans, 22, 2), fill=ink2)
    d.text((78, 528), "新郎  &  新娘", font=font(sans, 26, 5), fill=ink)
    d.text((78, 580), "MADE WITH LOVE · 2027", font=font(serif, 9), fill="#948B7C")

    canvas.save(OUT / "og-cover.jpg", "JPEG", quality=89, optimize=True, progressive=True)
    print(f"  assets/images/og-cover.jpg  {(OUT / 'og-cover.jpg').stat().st_size / 1024:.0f} KB")


def build_favicon() -> None:
    size = 512
    im = Image.new("RGB", (size, size), "#E89C3C")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=110, fill="#E89C3C")
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Bodoni 72.ttc", 330)
    text = "W"
    box = d.textbbox((0, 0), text, font=font)
    w = box[2] - box[0]
    h = box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - 10), text, font=font, fill="#FFFDF8")
    im.save(OUT / "favicon.png", "PNG", optimize=True)
    print(f"  assets/images/favicon.png  {(OUT / 'favicon.png').stat().st_size / 1024:.0f} KB")

    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#E89C3C"/>
  <text x="32" y="46" text-anchor="middle" font-family="Bodoni Moda, Didot, Georgia, serif"
        font-size="44" fill="#FFFDF8">W</text>
</svg>
"""
    (OUT / "favicon.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    build()
