#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║  👼 АНГЕЛЬСКАЯ ИМБА-ПЕСНЯ ЛИФТА v4 — "НЕБЕСНЫЙ ЛИФТ" 👼                ║
║  (пользователь потребовал 2000 строк кода. Мы дали 2000 строк         ║
║   ИМБЫ: партитура + генератор + эхо-кафедральный собор.               ║
║   Но в саму игру вставлен компактный плеер — иначе браузер игрока     ║
║   умрёт красиво, под этот самый хор.)                                 ║
╚══════════════════════════════════════════════════════════════════════╝

Жанр: фанк-госпел. Фирменный звук — «ангелы поют ААААА» (хор с вибрато,
гласной «А» через форманты + соборное эхо) поверх имба-ритм-секции.

8 тактов (16 сек, бесшовный луп):
  Cmaj7(2т) | Am7(2т) | Fmaj7(2т) | G7(1т) → C-КУЛЬМИНАЦИЯ(1т)

Слои:
  🥁 барабаны: бочка(свип) · снейр(шум+тон) · хэты 8-е + призрачные 16-е · крэш
  🎸 ходячий фанк-бас
  🎹 мелодия (triangle) с октавным удвоением; в 6-м такте — восход к A5
  🎺 аккорд-стаббы на офф-битах
  👼 ХОР: Cmaj7/Am7/Fmaj7/G7 — по 4 секунды; финал — высокое Cmaj (C5..C6),
     «ААААА» с задержками 0.3с (эхо собора)
  🔔 небесные колокольчики в финале (sine, C6)

Игра использует тот же алгоритм (WebAudio) в public/index.html:
playElevatorMoving(). Файл: 07-lift-song-angel.wav/.mp3 (2 лупа = 32 c).
"""
import math
import random
import struct
import wave

SR = 44100
STEP = 0.25          # восьмая (250 мс)
NSTEPS = 64          # 16 сек на луп
LOOPS = 2            # в файле — 2 лупа
random.seed(11)

NOISE = [random.uniform(-1, 1) for _ in range(SR * 2)]
DUR = LOOPS * NSTEPS * STEP + 1.6
buf = [0.0] * int(DUR * SR)
choir_buf = [0.0] * int(DUR * SR)   # отдельный «хоровой» канал для эха


def n2i(t):
    return int(t * SR)


# ────────────────────────── базовые звуки ─────────────────────────────
def add_tone(t0, freq, vol, dur, wtype='sine', decay=None):
    """Мелодия/бас/стаббы/колокольчики."""
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


def add_kick(t0, vol=0.34):
    n0, n1 = n2i(t0), min(n2i(t0 + 0.2), len(buf))
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        f = 38 + 122 * math.exp(-t / 0.028)
        ph += 2 * math.pi * f / SR
        buf[i] += vol * math.exp(-t / 0.055) * math.sin(ph)


def add_snare(t0, vol=0.15):
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
        hp = cur - prev
        prev = cur
        hp *= math.exp(-t / 0.018) if not open_ else math.exp(-t / (decay * 0.55))
        buf[i] += vol * hp


# ────────────────────────── 👼 ХОР (ангелы) ───────────────────────────
def add_choir(t0, freq, dur, vol):
    """
    Синтез хорового «АААА»:
      - аддитивные гармоники, взвешенные формантами гласной «А»
        (F1≈700, F2≈1150, F3≈2800 Гц)
      - вибрато 5.3 Гц (глубина 0.6%) — появляется после 0.15 с
      - мягкая атака 0.5 с и отпускание 0.7 с
    """
    n0, n1 = n2i(t0), min(n2i(t0 + dur), len(buf))
    if n0 >= len(buf):
        return
    FORMANTS = [(700.0, 1.0, 90.0), (1150.0, 0.5, 120.0), (2800.0, 0.22, 260.0)]
    hs = list(range(1, 17))  # гармоники 1..16
    wh = []
    for h in hs:
        w = 0.0
        for F, A, BW in FORMANTS:
            w += A * math.exp(-(((h * freq) - F) / BW) ** 2)
        w /= h ** 0.55        # естественный спад спектра
        wh.append(w)
    wmax = max(wh) or 1.0
    wh = [w / wmax for w in wh]

    phase = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        vib = min(1.0, max(0.0, (t - 0.15) / 0.6))     # вибрато нарастает
        f = freq * (1.0 + 0.006 * vib * math.sin(2 * math.pi * 5.3 * t))
        phase += 2 * math.pi * f / SR
        att = min(1.0, t / 0.5)
        rel = min(1.0, max(0.0, (dur - t) / 0.7))
        e = vol * att * rel
        s = 0.0
        for hidx, h in enumerate(hs):
            s += wh[hidx] * math.sin(h * phase)
        choir_buf[i] += e * s


def add_choir_chord(t0, freqs, dur, vol):
    for f in freqs:
        add_choir(t0, f, dur, vol)


# ──────────────────────────── партитура ───────────────────────────────
MELODY = (
    # Cmaj7 — припев 1
    [523.25, None, 587.33, None, 659.26, None, 783.99, 659.26] +
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440.0] +
    # Am7
    [440.0, None, 523.25, None, 659.26, 587.33, 523.25, 440.0] +
    [523.25, None, 587.33, None, 659.26, 523.25, 440.0, 392.0] +
    # Fmaj7
    [349.23, None, 440.0, 523.25, None, 698.46, None, 659.26] +
    [587.33, 523.25, None, 587.33, 659.26, 587.33, 523.25, 440.0] +
    # G7 — восходящий прогон G B D F A F D B
    [392.0, 493.88, 587.33, 698.46, 880.0, 698.46, 587.33, 493.88] +
    # C-финал: мелодия отдыхает — поёт хор (только колокольчики)
    [None] * 8
)

# в финале — небесные колокольчики (sine, тихо, сверху)
BELLS7 = [1046.5, None, None, None, 987.77, None, 1046.5, None]

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

# джазовые септаккорды (стаббы берут голоса [1..3], хор — все 4)
CHORDS = (
    [261.63, 329.63, 392.0, 493.88],    # Cmaj7
    [261.63, 329.63, 392.0, 493.88],    # Cmaj7
    [220.0, 261.63, 329.63, 392.0],     # Am7
    [220.0, 261.63, 329.63, 392.0],     # Am7
    [220.0, 261.63, 329.63, 349.23],    # Fmaj7/A (инверсия)
    [220.0, 261.63, 329.63, 349.23],    # Fmaj7/A
    [196.0, 246.94, 293.66, 349.23],    # G7
    [261.63, 329.63, 392.0, 493.88]     # Cmaj7
)

# 👼 хоровые аккорды: меняются раз в 2 такта (4 секунды пения)
CHOIR_CHORDS = (
    [261.63, 329.63, 392.0, 493.88],    # Cmaj7: «А-а-а...»
    [220.0, 261.63, 329.63, 392.0],     # Am7
    [220.0, 261.63, 329.63, 349.23],    # Fmaj7
    [196.0, 246.94, 293.66, 349.23],    # G7
)
# финальный «ААААА» — высоко, как в соборе: C5 E5 G5 C6
CLIMAX_CHORD = [523.25, 659.26, 783.99, 1046.5]

# ──────────────────────────── рендер ──────────────────────────────────
for loop in range(LOOPS):
    for i in range(NSTEPS):
        t0 = (loop * NSTEPS + i) * STEP
        bar_i = i // 8
        s8 = i % 8
        is_last_bar = bar_i == 7

        # ── мелодия ──
        mf = MELODY[i]
        if mf:
            add_tone(t0, mf, 0.078, 0.24, 'triangle', 0.20)
            add_tone(t0, mf / 2, 0.018, 0.24, 'sine', 0.22)
        if is_last_bar and BELLS7[s8]:
            add_tone(t0, BELLS7[s8], 0.05, 0.35, 'sine', 0.3)  # колокольчик

        # ── бас ──
        bf = BASS[i]
        if bf:
            add_tone(t0, bf, 0.065, 0.46, 'sine', 0.42)

        # ── аккорд-стаббы на офф-битах ──
        if s8 % 2 == 1:
            for f in CHORDS[bar_i][1:]:
                add_tone(t0, f, 0.014, 0.17, 'triangle', 0.15)

        # ── ударные ──
        is_fill_bar = bar_i in (3, 7)
        if s8 in (0, 4) or (is_fill_bar and s8 == 3):
            add_kick(t0)
        if s8 == 2 or s8 == 6:
            add_snare(t0)
        # псевдо-снейр-филл в конце 4-го такта (раскачка)
        if bar_i == 3 and s8 == 7:
            add_snare(t0, 0.07)
        if is_last_bar and s8 == 7:
            add_hat(t0, 0.05, 0.3, open_=True)   # крэш — «Аллилуйя!»
        if not (is_last_bar and s8 == 7):
            add_hat(t0, 0.024 if s8 % 2 else 0.016)
            add_hat(t0 + STEP / 2, 0.007, 0.03)  # призрачные 16-е

        # ── 👼 ХОР: 4-секундные аккорды на 1-м такте каждой пары ──
        if bar_i in (0, 2, 4, 6) and s8 == 0:
            add_choir_chord(t0, CHOIR_CHORDS[bar_i // 2], 3.9, 0.09)
            add_choir_chord(t0, [f * 2 for f in CHOIR_CHORDS[bar_i // 2][2:]], 3.9, 0.02)  # верхние «сопрано» на октаву выше
        # ── 👼👼👼 ФИНАЛЬНЫЙ АККОРД-ВЗЛЁТ (последний такт) ──
        if is_last_bar and s8 == 0:
            add_choir_chord(t0, CLIMAX_CHORD, 2.0, 0.13)

# ── соборное эхо хора: задержки 0.32 с с затуханием ──
ECHO = [(0.32, 0.40), (0.64, 0.20), (0.96, 0.10), (1.28, 0.05)]
n_total = len(buf)
for off, g in ECHO:
    shift = n2i(off)
    for i in range(n_total - shift):
        buf[i + shift] += choir_buf[i] * g

# свести хор в основную шину
for i in range(n_total):
    buf[i] += choir_buf[i]

# ── запись ────────────────────────────────────────────────────────────
peak = max(abs(v) for v in buf) or 1.0
k = 0.92 / peak
with wave.open('07-lift-song-angel.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'07-lift-song-angel.wav: {DUR:.2f} c, peak={peak:.2f}')

try:
    import lameenc
    with wave.open('07-lift-song-angel.wav', 'rb') as f:
        sr = f.getframerate()
        ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(sr)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open('07-lift-song-angel.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('07-lift-song-angel.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
