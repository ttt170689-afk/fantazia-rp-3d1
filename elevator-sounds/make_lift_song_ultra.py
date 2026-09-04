#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║  🚀 СУПЕР-МЕГА-ДУПЕР-УЛЬТРА ПЕСНЯ ЛИФТА v5 "TURBO FUNK" 🚀            ║
║                                                                      ║
║  ✅ ГОЛОС «ААА» ПОЛНОСТЬЮ УБРАН (по приказу шефа)                    ║
║  ✅ ТЕМП: 8-я = 0.18 с  →  ~167 BPM  (было 120!)  БЫСТРЕЕ В 1.4 РАЗА ║
║  ✅ бас пульсирует КАЖДУЮ восьмую (диско-октавы)                     ║
║  ✅ финал: разгон C5→D5→E5→F5→G5→A5→B5→C6 + крэш + «пинг» C7        ║
║  ✅ снейр-роллы 16-ми в 4-м такте (раскачка)                        ║
╚══════════════════════════════════════════════════════════════════════╝

8 тактов (11.52 сек, бесшовный луп): C | C | Am | Am | F | F | G7 | C-FINAL

Файл: 08-lift-song-ultra.wav/.mp3 (2 лупа ≈ 23 c)
"""
import math
import random
import struct
import wave

SR = 44100
STEP = 0.18           # 8-я нота (БЫСТРО!)
STEP16 = STEP / 2     # 16-я
NSTEPS = 64
LOOPS = 2
random.seed(23)

NOISE = [random.uniform(-1, 1) for _ in range(SR * 2)]
DUR = LOOPS * NSTEPS * STEP + 0.4
buf = [0.0] * int(DUR * SR)


def n2i(t):
    return int(t * SR)


def add_tone(t0, freq, vol, dur, wtype='sine', decay=None):
    if decay is None:
        decay = dur * 0.9
    tau = decay / math.log((vol or 0.001) / 0.0005)
    n0, n1 = n2i(t0), min(n2i(t0 + dur), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        ph += 2 * math.pi * freq / SR
        s = math.sin(ph) if wtype == 'sine' else 2 / math.pi * math.asin(math.sin(ph))
        buf[i] += vol * math.exp(-t / tau) * s


def add_kick(t0, vol=0.36):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.18), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        f = 38 + 122 * math.exp(-t / 0.025)
        ph += 2 * math.pi * f / SR
        buf[i] += vol * math.exp(-t / 0.05) * math.sin(ph)


def add_snare(t0, vol=0.15):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.14), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        ph += 2 * math.pi * 186 / SR
        body = math.exp(-t / 0.045) * math.sin(ph)
        nz = NOISE[(i - 1) % len(NOISE)]
        buf[i] += vol * (0.55 * nz * math.exp(-t / 0.04) + 0.45 * body)


def add_hat(t0, vol=0.05, decay=0.045, open_=False):
    n0, n1 = n2i(t0), min(n2i(t0 + decay + 0.05), len(buf))
    prev = NOISE[n0 % len(NOISE)]
    for i in range(n0 + 1, n1):
        t = (i - n0) / SR
        cur = NOISE[i % len(NOISE)]
        hp = cur - prev
        prev = cur
        hp *= math.exp(-t / 0.018) if not open_ else math.exp(-t / (decay * 0.55))
        buf[i] += vol * hp


# ──────────────────────────── партитура ───────────────────────────────
# Мелодия: 8 тактов. Последний — полный разгон до C6!
MELODY = (
    # C
    [523.25, None, 587.33, None, 659.26, None, 783.99, 659.26] +
    # C
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440.0] +
    # Am
    [440.0, None, 523.25, None, 659.26, 587.33, 523.25, 440.0] +
    # Am
    [523.25, None, 587.33, None, 659.26, 523.25, 440.0, 392.0] +
    # F
    [349.23, None, 440.0, 523.25, None, 698.46, None, 659.26] +
    # F
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440.0] +
    # G7 — взлёт к B5
    [392.0, 493.88, 587.33, 698.46, 880.0, 987.77, 880.0, 698.46] +
    # C — ФИНАЛЬНЫЙ РАЗГОН C5→C6
    [523.25, 587.33, 659.26, 698.46, 783.99, 880.0, 987.77, 1046.5]
)

# корни баса по тактам (C3 C3 A2 A2 F2 F2 G2 C3)
ROOTS = [130.81, 130.81, 110.0, 110.0, 87.31, 87.31, 98.0, 130.81]

# аккорды-стаббы
CHORDS = (
    [261.63, 329.63, 392.0, 493.88], [261.63, 329.63, 392.0, 493.88],
    [220.0, 261.63, 329.63, 392.0], [220.0, 261.63, 329.63, 392.0],
    [220.0, 261.63, 329.63, 349.23], [220.0, 261.63, 329.63, 349.23],
    [196.0, 246.94, 293.66, 349.23], [261.63, 329.63, 392.0, 493.88],
)

# ──────────────────────────── рендер ──────────────────────────────────
for loop in range(LOOPS):
    for i in range(NSTEPS):
        t0 = (loop * NSTEPS + i) * STEP
        bar_i = i // 8
        s8 = i % 8
        lastBar = bar_i == 7

        # 🎹 мелодия (с октавным удвоением вниз — сочно)
        mf = MELODY[i]
        if mf:
            add_tone(t0, mf, 0.085, 0.2, 'triangle', 0.17)
            add_tone(t0, mf / 2, 0.022, 0.2, 'sine', 0.18)

        # 🎸 бас-пульс: НА КАЖДОЙ восьмой (низ / октава) — диско-драйв
        R = ROOTS[bar_i]
        if s8 % 2 == 0:
            add_tone(t0, R, 0.062, 0.16, 'sine', 0.15)
        else:
            add_tone(t0, R * 2, 0.034, 0.14, 'sine', 0.13)

        # 🎺 аккорд-стаббы на офф-битах
        if s8 % 2 == 1:
            for f in CHORDS[bar_i][1:]:
                add_tone(t0, f, 0.015, 0.14, 'triangle', 0.13)

        # 🥁 бочка: 1 и 3; в 4-м такте бонус; в финале — удар с крэшем
        if s8 in (0, 4) or (bar_i == 3 and s8 == 7) or (lastBar and s8 == 7):
            add_kick(t0)
        # 🥁 снейр: 2 и 4
        if s8 in (2, 6):
            add_snare(t0)
        # 🥁 снейр-роллы 16-ми: 4-й такт (раскачка перед разгоном)
        if bar_i == 3 and s8 == 6:
            add_snare(t0 + STEP16, 0.09)
        if bar_i == 3 and s8 == 7:
            add_snare(t0, 0.11)
            add_snare(t0 + STEP16, 0.09)
        if lastBar and s8 == 7:
            add_snare(t0 + STEP16, 0.07)
        # 🥁 хэты: на каждую 8-ю + призрачные 16-е
        if lastBar and s8 == 7:
            add_hat(t0, 0.06, 0.35, open_=True)     # КРЭШ
        else:
            add_hat(t0, 0.026 if s8 % 2 else 0.016)
            if not (bar_i == 3 and s8 == 7):
                add_hat(t0 + STEP16, 0.008, 0.03)
        # 🔔 финальный «пинг» C7 в конце разгона
        if lastBar and s8 == 7:
            add_tone(t0, 2093.0, 0.028, 0.3, 'sine', 0.25)

# ── запись ────────────────────────────────────────────────────────────
peak = max(abs(v) for v in buf) or 1.0
k = 0.92 / peak
with wave.open('08-lift-song-ultra.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'08-lift-song-ultra.wav: {DUR:.2f} c, peak={peak:.2f}')

try:
    import lameenc
    with wave.open('08-lift-song-ultra.wav', 'rb') as f:
        sr = f.getframerate()
        ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(sr)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open('08-lift-song-ultra.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('08-lift-song-ultra.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
