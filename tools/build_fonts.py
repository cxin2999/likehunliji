#!/usr/bin/env python3
"""
构建自托管字体子集（Google Fonts，SIL OFL 协议）。

只有页面真正用到的字符会被打进 woff2，中文手写字体从数 MB 压到几 KB。
修改文案后如果手写体出现「豆腐块」，运行本脚本重新生成即可；
请同步更新下面的 HAND_TEXT / LATIN_TEXT 字符集。

用法：python3 tools/build_fonts.py
"""

from __future__ import annotations

import re
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
CSS_OUT = ROOT / "assets" / "css" / "fonts.css"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "licenses").mkdir(exist_ok=True)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# 使用 Ma Shan Zheng 手写体的全部中文
HAND_TEXT = "欢迎参加我们的婚礼要结啦愿岁常相见囍，"
# 英文展示衬线 / 花体需要的字符
LATIN_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 &.,:;·'-/&"
# 倒计时数字
NUM_TEXT = "0123456789:., "


def curl(url: str) -> bytes:
    res = subprocess.run(
        ["curl", "-sL", "--max-time", "60", "-A", UA, url],
        check=True,
        stdout=subprocess.PIPE,
    )
    return res.stdout


def fetch_css(family: str, text: str) -> str:
    q = urllib.parse.quote(text, safe="")
    url = f"https://fonts.googleapis.com/css2?family={family}&text={q}&display=swap"
    return curl(url).decode("utf-8")


def extract_faces(css: str) -> list[dict[str, str]]:
    faces = []
    for block in re.findall(r"@font-face\s*{(.*?)}", css, re.S):
        weight = re.search(r"font-weight:\s*([^;]+);", block)
        src = re.search(r"url\((https://[^)]+)\)", block)
        if not src:
            continue
        faces.append({"weight": (weight.group(1).strip() if weight else "400"), "url": src.group(1)})
    return faces


def download(url: str, name: str) -> None:
    data = curl(url)
    path = OUT / name
    path.write_bytes(data)
    print(f"  {path.relative_to(ROOT)}  {len(data) / 1024:.1f} KB")


def main() -> None:
    print("Ma Shan Zheng（中文手写）")
    msz = extract_faces(fetch_css("Ma+Shan+Zheng", HAND_TEXT))
    download(msz[0]["url"], "ma-shan-zheng.woff2")

    print("Great Vibes（英文花体）")
    gv = extract_faces(fetch_css("Great+Vibes", LATIN_TEXT))
    download(gv[0]["url"], "great-vibes.woff2")

    print("Bodoni Moda（英文展示衬线）")
    bodoni = extract_faces(fetch_css("Bodoni+Moda:wght@400", LATIN_TEXT))
    download(bodoni[0]["url"], "bodoni-moda-400.woff2")

    print("Barlow Condensed（倒计时数字）")
    barlow = extract_faces(fetch_css("Barlow+Condensed:wght@500;600", NUM_TEXT))
    seen = {}
    for f in barlow:
        seen.setdefault(f["weight"], f["url"])
    for weight, url in seen.items():
        download(url, f"barlow-condensed-{weight}.woff2")

    css = """/* 由 tools/build_fonts.py 生成 —— 请勿手改，重新生成即可 */
@font-face {
  font-family: 'Ma Shan Zheng';
  src: url('../fonts/ma-shan-zheng.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Great Vibes';
  src: url('../fonts/great-vibes.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Bodoni Moda';
  src: url('../fonts/bodoni-moda-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('../fonts/barlow-condensed-500.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('../fonts/barlow-condensed-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
"""
    CSS_OUT.write_text(css, encoding="utf-8")
    print(f"  {CSS_OUT.relative_to(ROOT)}")

    print("OFL 授权文件")
    families = {
        "mashanzheng": "OFL-MaShanZheng.txt",
        "greatvibes": "OFL-GreatVibes.txt",
        "bodonimoda": "OFL-BodoniModa.txt",
        "barlowcondensed": "OFL-BarlowCondensed.txt",
    }
    for slug, name in families.items():
        url = f"https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/{slug}/OFL.txt"
        try:
            (OUT / "licenses" / name).write_bytes(curl(url))
            print(f"  assets/fonts/licenses/{name}")
        except subprocess.CalledProcessError:
            print(f"  ! 未能下载 {slug} 的 OFL.txt")

    total = sum(p.stat().st_size for p in OUT.glob("*.woff2"))
    print(f"\n字体总体积：{total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
