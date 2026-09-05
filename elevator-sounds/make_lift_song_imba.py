#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔥 ИМБА-ПЕСНЯ ЛИФТА v3 для Fantazia RP 3D1 — теперь ПОЛНЫЙ фанк-трек!

8 тактов (16 сек, бесшовный луп):
  Cmaj7 | Cmaj7 | Am7 | Am7 | Fmaj7 | Fmaj7 | G7 | C (кульминация!)

Звуки:
  - 🥁 УДАРНЫЕ: бочка (свип 160→40Гц), снейр (шум+тон), хай-хэты 8-ми +
    призрачные 16-е, крэш в конце
  - 🎸 ходячий фанк-бас (sine, четверти)
  - 🎹 мелодия (triangle) с восходящей кульминацией C5→B5
  - 🎺 аккордовые стаббы на офф-битах (джазовые 7-аккорды)

Игра использует тот же алгоритм в WebAudio (public/index.html,
playElevatorMoving). Файл: 06-lift-song-imba.wav/.mp3
"""
import math
import random
import struct
import wave

SR = 44100
STEP = 0.25
NSTEPS = 64          # 16 секунд — один луп
LOOPS = 2
random.seed(7)

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
        if wtype == 'sine':
            s = math.sin(ph)
        else:
            s = 2 / math.pi * math.asin(math.sin(ph))
        env = vol * math.exp(-t / tau)
        buf[i] += env * s


def add_kick(t0, vol=0.34):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.2), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        f = 38 + 122 * math.exp(-t / 0.028)
        ph += 2 * math.pi * f / SR
        buf[i] += vol * math.exp(-t / 0.055) * math.sin(ph)


def add_snare(t0, vol=0.16):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.16), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        ph += 2 * math.pi * 186 / SR
        body = math.exp(-t / 0.05) * math.sin(ph)
        nz = NOISE[(i - 1) % len(NOISE)]
        buf[i] += vol * (0.55 * nz * math.exp(-t / 0.045) + 0.45 * body)


def add_hat(t0, vol=0.05, decay=0.045, open_=False):
    n0, n1 = n2i(t0), min(n2i(t0 + decay + 0.05), len(buf))
    prev = NOISE[n0 % len(NOISE)]
    for i in range(n0 + 1, n1):
        t = (i - n0) / SR
        cur = NOISE[i % len(NOISE)]
        hp = cur - prev                      # примитивный high-pass
        prev = cur
        if open_:
            hp *= math.exp(-t / (decay * 0.55))
        else:
            hp *= math.exp(-t / 0.018)
        buf[i] += vol * hp


# ── партитура (64 шага, по 8 на такт) ────────────────────────────────
BAR = lambda lst: lst * 8  # noqa
MELODY = (
    [523.25, None, 587.33, None, 659.26, None, 783.99, 659.26] +  # C
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440] +  # C
    [440, None, 523.25, None, 659.26, 587.33, 523.25, 440] +       # Am
    [523.25, None, 587.33, None, 659.26, 523.25, 440, 392] +       # Am
    [349.23, None, 440, 523.25, None, 698.46, None, 659.26] +      # F
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440] +  # F
    [392, 493.88, 587.33, None, 783.99, 659.26, 587.33, 493.88] +  # G7
    [523.25, 659.26, 783.99, 880, 987.77, 880, 783.99, 659.26]     # C-кульминация
)
BASS = (
    [130.81, None, 164.81, None, 196.0, None, 261.63, None] +
    [196.0, None, 164.81, None, 146.83, None, 123.47, None] +
    [110.0, None, 130.81, None, 164.81, None, 220.0, None] +
    [196.0, None, 164.81, None, 146.83, None, 130.81, None] +
    [87.31, None, 110.0, None, 130.81, None, 174.61, None] +
    [130.81, None, 146.83, None, 174.61, None, 196.0, None] +
    [98.0, None, 123.47, None, 146.83, None, 196.0, None] +
    [130.81, None, 146.83, None, 164.81, None, 196.0, None]
)
# джазовые 7-аккорды (для стаббов берём голоса [1..3])
CHORDS = (
    [261.63, 329.63, 392.0, 493.88],     # Cmaj7  C4 E4 G4 B4
    [261.63, 329.63, 392.0, 493.88],     # Cmaj7
    [220.0, 261.63, 329.63, 392.0],      # Am7    A3 C4 E4 G4
    [220.0, 261.63, 329.63, 392.0],      # Am7
    [220.0, 261.63, 329.63, 349.23],     # Fmaj7  A3 C4 E4 F4
    [220.0, 261.63, 329.63, 349.23],     # Fmaj7
    [246.94, 293.66, 349.23, 392.0],     # G7     B3 D4 F4 G4
    [261.63, 329.63, 392.0, 493.88]      # Cmaj7
)

# ── рендер ────────────────────────────────────────────────────────────
for loop in range(LOOPS):
    for i in range(NSTEPS):
        t0 = (loop * NSTEPS + i) * STEP
        bar_i = i // 8
        step_i = i % 8

        mf = MELODY[i]
        if mf:
            # мелодия + лёгкое удвоение через октаву вниз для сочности
            add_tone(t0, mf, 0.078, 0.24, 'triangle', 0.20)
            add_tone(t0, mf / 2, 0.018, 0.24, 'sine', 0.22)

        bf = BASS[i]
        if bf:
            add_tone(t0, bf, 0.065, 0.46, 'sine', 0.42)

        if step_i % 2 == 1:  # аккорд-стабб на офф-битах
            for f in CHORDS[bar_i][1:]:
                add_tone(t0, f, 0.014, 0.17, 'triangle', 0.15)

        # ударные
        is_last_bar = bar_i == 7
        is_fill_bar = bar_i in (3, 7)
        if step_i in (0, 4) or (is_fill_bar and step_i == 3):
            add_kick(t0)
        if step_i in (2, 6):
            add_snare(t0)
        if step_i == 7 and bar_i == 7:
            add_hat(t0, 0.045, 0.28, open_=True)          # крэш в конце
        if step_i in (3, 7) and is_last_bar and False:
            pass
        # хэт: на каждой восьмой (акцент на офф-битах)
        if step_i == 7 and is_last_bar:
            pass  # крэш уже сыграл
        elif not (step_i == 7 and is_last_bar):
            add_hat(t0, 0.024 if step_i % 2 else 0.016)
        # призрачные 16-е хэты (офф-бит каждой восьмой) — придаёт драйв
        if step_i != 7 or not is_last_bar:
            add_hat(t0 + STEP / 2, 0.007, 0.03)

# ── запись ────────────────────────────────────────────────────────────
peak = max(abs(v) for v in buf) or 1.0
k = 0.9 / peak
with wave.open('06-lift-song-imba.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'06-lift-song-imba.wav: {DUR:.2f} c, peak={peak:.2f}')

try:
    import lameenc
    with wave.open('06-lift-song-imba.wav', 'rb') as f:
        sr = f.getframerate(); ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192); enc.set_in_sample_rate(sr)
    enc.set_channels(ch); enc.set_quality(2)
    with open('06-lift-song-imba.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('06-lift-song-imba.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
