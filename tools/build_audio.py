#!/usr/bin/env python3
"""
生成一段轻柔、可循环的背景音乐（约 64 秒）。

不是采样素材，而是用正弦叠加 + 卷积混响合成的「音乐盒 / 毛毡钢琴」质感，
音量很低，只作为页面氛围。想换成自己的歌：把 mp3 放到 assets/audio/bgm.mp3
覆盖即可，页面无需改代码。

用法：python3 tools/build_audio.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "bgm.mp3"
OUT.parent.mkdir(parents=True, exist_ok=True)

SR = 44100
DUR = 64.0
TAIL = 4.0
N = int(SR * DUR)
NT = int(SR * TAIL)

rng = np.random.default_rng(20270123)

# D 大调：D - Bm7 - Gmaj7 - A7sus4，每个和弦 8 秒，共两遍
CHORDS = [
    [146.83, 185.00, 220.00, 277.18, 329.63],  # Dmaj9  D3 F#3 A3 C#4 E4
    [123.47, 146.83, 185.00, 220.00],          # Bm7     B2 D3 F#3 A3
    [98.00, 123.47, 146.83, 185.00],           # Gmaj7   G2 B2 D3 F#3
    [110.00, 146.83, 164.81, 196.00],          # A7sus4  A2 D3 E3 G3
]
BAR = 8.0
MELODY = [
    [587.33, 739.99, 880.00, 1174.66],  # D5 F#5 A5 D6
    [493.88, 587.33, 739.99, 987.77],   # B4 D5 F#5 B5
    [392.00, 493.88, 587.33, 783.99],   # G4 B4 D5 G5
    [440.00, 587.33, 659.25, 880.00],   # A4 D5 E5 A5
]


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def pluck(freq: float, dur: float, amp: float, bright: float = 0.5) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    partials = [(1.0, 1.0), (2.003, 0.34 * bright), (3.011, 0.14 * bright),
                (4.022, 0.07 * bright), (5.041, 0.03 * bright)]
    for k, a in partials:
        decay = 0.65 + 1.15 * k
        y += a * np.sin(2 * np.pi * freq * k * t + rng.uniform(0, 0.4)) * np.exp(-t * decay)
    # 轻微的击弦噪声，让音头不那么塑料
    noise = rng.normal(0, 1, n) * np.exp(-t * 55) * 0.025
    y = lowpass(y + noise, 4200)
    # 起音 8ms，避免爆音
    attack = np.minimum(t / 0.008, 1)
    y *= attack
    return (y * amp).astype(np.float64)


def pad(freqs: list[float], dur: float, amp: float) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        vib = 1 + 0.0015 * np.sin(2 * np.pi * 0.13 * t + rng.uniform(0, 6))
        y += np.sin(2 * np.pi * f * vib * t) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.05 * t + 1.1))
        y += 0.25 * np.sin(2 * np.pi * f * 2 * t + 0.7)
    env = np.minimum(t / 3.0, 1) * np.minimum((dur - t) / 2.5, 1)
    y = lowpass(y, 1400)
    return (y * env * amp).astype(np.float64)


def add(buf: np.ndarray, sig: np.ndarray, start: float, gain: float = 1.0) -> None:
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


# 干声
dry = np.zeros(N + NT)

for rep in range(2):
    for ci, chord in enumerate(CHORDS):
        bar_start = rep * len(CHORDS) * BAR + ci * BAR
        # 低音
        add(dry, pluck(chord[0] / 2, 6.5, 0.24, 0.25), bar_start)
        # 和声铺底
        add(dry, pad(chord, BAR + 1.0, 0.016), bar_start)
        # 琶音：每 1 秒一个音，落点错开
        pattern = [0, 2, 1, 3, 2, 4 % len(chord), 1, 2]
        for step in range(8):
            note = chord[pattern[step] % len(chord)] * 2
            vel = 0.16 + 0.05 * rng.random()
            add(dry, pluck(note, 4.0, vel, 0.55), bar_start + step * 1.0 + rng.uniform(-0.01, 0.01))
        # 高音音乐盒，只在每小节头两拍
        m = MELODY[ci]
        add(dry, pluck(m[0], 5.0, 0.10, 0.35), bar_start + 0.2)
        add(dry, pluck(m[2], 5.0, 0.07, 0.35), bar_start + 4.2)
        if rep == 1:
            add(dry, pluck(m[3], 5.0, 0.06, 0.30), bar_start + 6.4)

# 立体声混响
def make_ir(seed: int) -> np.ndarray:
    r = np.random.default_rng(seed)
    n = int(SR * 3.2)
    t = np.arange(n) / SR
    ir = r.normal(0, 1, n) * np.exp(-t / 1.05)
    ir = lowpass(ir, 3200)
    sos = butter(2, 180, btype="highpass", fs=SR, output="sos")
    ir = sosfilt(sos, ir)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    return ir


def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = 1 << (len(x) + len(ir) - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]


left = 0.72 * dry + 0.55 * convolve(dry, make_ir(7))
right = 0.72 * dry + 0.55 * convolve(dry, make_ir(21))

# 把结尾混响折回开头，让循环接缝自然
left[:NT] += left[N:N + NT]
right[:NT] += right[N:N + NT]
left = left[:N]
right = right[:N]

# 去掉浑浊的超低频，手机外放也能听清
sos = butter(2, 95, btype="highpass", fs=SR, output="sos")
left = sosfilt(sos, left)
right = sosfilt(sos, right)

# 母带：柔和限幅 + 统一音量
stereo = np.stack([left, right], axis=1)
stereo = np.tanh(stereo * 1.1) / 1.1
stereo -= stereo.mean()
peak = np.max(np.abs(stereo))
stereo = stereo / peak * 0.82
# 首尾各 30ms 淡入淡出，避免播放器爆音
fade = int(0.03 * SR)
stereo[:fade] *= np.linspace(0, 1, fade)[:, None]
stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]

pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
tmp = OUT.with_suffix(".raw")
pcm.tofile(tmp)

import subprocess

subprocess.run(
    [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(tmp),
        "-af", "loudnorm=I=-18:TP=-2:LRA=6",
        "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
        "-metadata", "title=Wedding Invitation BGM",
        "-metadata", "artist=Original ambient loop",
        str(OUT),
    ],
    check=True,
)
tmp.unlink()

print(f"  {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB  {DUR:.0f}s")
