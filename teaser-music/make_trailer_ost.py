#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║  🎬 СУПЕР-МЕГА-ХОРРОР САУНДТРЕК ПОЛНОГО ТРЕЙЛЕРА "GRAND MALL SECRET" ║
║  (синхронизирован с таймлайном teaser.html)                          ║
║                                                                      ║
║  Секции (абсолютное время видео):                                    ║
║   0.0–15.5  «Подход»: тёмный дрон, сердце ускоряется, уколы          ║
║   15.50     💥 РУБИЛЬНИК: тьма — огромный удар, затихание             ║
║   18.05     ⚡ ГЛЮЧ: резкие стаккато-глитчи                           ║
║   18.45     🪑 Кресло: скрип, шаги-удары, райзер                      ║
║   20.85/21.15 💥💥 ГРОХОТ: двойные удары + кластеры                   ║
║   23.90     🌑 в темноту, почти тишина                                ║
║   24.80     ТИТРЫ: FANTAZIA RP мигает (дрон + сердце)                ║
║   28.20     ✂️ перечёркивание: удар + скрежет + тиканье               ║
║   29.80     🏬 GRAND MALL SECRET: бас-пульс + пэд + мотив             ║
║   32.00     🚀 SOON: МЕГА-БУМ + широкий кластер + колокола            ║
║   ~36.3     финальное затухание (тизер закрывается)                   ║
╚══════════════════════════════════════════════════════════════════════╝
"""
import math
import random
import struct
import wave

SR = 44100
random.seed(77)
NOISE = [random.uniform(-1, 1) for _ in range(SR * 4)]
DUR = 38.6
buf = [0.0] * int(DUR * SR)
N = len(buf)


def n2i(t):
    return int(t * SR)


# ── базовые генераторы ────────────────────────────────────────────────
def add_tone(t0, f0, f1, vol, dur, wtype='sine', attack=0.03, vib_rate=0.0, vib_dep=0.0):
    """Тон с глиссандо f0→f1 и экспоненциальным спадом + опц. вибрато."""
    n0, n1 = n2i(t0), min(n2i(t0 + dur), N)
    if n0 >= N:
        return
    tau = dur * 0.6
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        k = min(1.0, t / (dur * 0.85))
        f = f0 + (f1 - f0) * k
        if vib_rate:
            f *= 1.0 + vib_dep * math.sin(2 * math.pi * vib_rate * t)
        ph += 2 * math.pi * f / SR
        s = math.sin(ph)
        if wtype == 'triangle':
            s = 2 / math.pi * math.asin(s)
        elif wtype == 'square':
            s = 1.0 if math.sin(ph) >= 0 else -1.0
        elif wtype == 'saw':
            s = 2 * (ph / (2 * math.pi) % 1.0) - 1.0
        at = min(1.0, t / attack) if attack > 0 else 1.0
        env = vol * at * math.exp(-t / tau)
        buf[i] += env * s


def add_kick(t0, vol=0.35, f_hi=85, f_lo=40, dur=0.35):
    n0, n1 = n2i(t0), min(n2i(t0 + dur), N)
    ph = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        f = f_lo + (f_hi - f_lo) * math.exp(-t / 0.06)
        ph += 2 * math.pi * f / SR
        buf[i] += vol * math.exp(-t / (dur * 0.32)) * math.sin(ph)


def add_noise(t0, dur, vol, lp=0.0, hp=0.0, decay_exp=True, at=0.02):
    """Шум: lp — коэффициент низкочастотности (0=нет), hp — highpass ratio."""
    n0, n1 = n2i(t0), min(n2i(t0 + dur), N)
    prev = NOISE[n0 % len(NOISE)]
    acc = 0.0
    for i in range(n0, n1):
        t = (i - n0) / SR
        cur = NOISE[i % len(NOISE)]
        diff = cur - prev
        prev = cur
        if lp > 0:
            acc += (diff - acc) * lp
            s = acc
        elif hp > 0:
            s = diff
        else:
            s = cur
        env = min(1.0, t / at)
        if decay_exp:
            env *= math.exp(-t / (dur * 0.55))
        else:
            env *= max(0.0, 1.0 - t / dur)
        buf[i] += vol * env * s * (3.0 if hp > 0 else 1.0)


def add_bell(t0, f, vol, dur=3.0):
    """Тёмный колокол: негармоничные частичные."""
    add_tone(t0, f, f * 0.999, vol, dur, 'sine', attack=0.004)
    add_tone(t0, f * 2.01, f * 2.01, vol * 0.22, dur * 0.72, 'sine', attack=0.004)
    add_tone(t0, f * 3.97, f * 3.97, vol * 0.09, dur * 0.55, 'sine', attack=0.003)
    add_tone(t0, f * 5.4, f * 5.4, vol * 0.04, dur * 0.4, 'sine', attack=0.002)


def boom(t0, v=1.0):
    """МЕГА-удар: саб-свип + шумовой транзиент + тёмный кластер."""
    add_kick(t0, 0.42 * v, 95, 26, 1.6)
    add_noise(t0, 0.7 * v * 0.9, 0.30 * v, hp=1.0, at=0.002)
    add_noise(t0, 1.6 * v, 0.10 * v, lp=0.04)
    for f, g in ((55, 0.11), (58.2, 0.08), (61.7, 0.06), (110, 0.035), (116.5, 0.025)):
        add_tone(t0, f * 1.6, f * 0.97, g * v, 2.6, 'saw', attack=0.012)
    add_tone(t0, 55, 27.5, 0.5 * v, 3.4, 'sine', attack=0.005)


def squeal(t0, dur=2.0, f0=2093, f1=2217, vol=0.006, rate=6.5):
    add_tone(t0, f0, f1, vol, dur, 'sine', vib_rate=rate, vib_dep=0.004)
    add_tone(t0, f0 * 1.004, f1 * 1.006, vol * 0.6, dur, 'sine', vib_rate=rate * 0.93, vib_dep=0.003)


def creak(t0, vol=0.035):
    add_tone(t0, 720, 170, vol, 1.5, 'saw', attack=0.01)
    add_tone(t0, 755, 185, vol * 0.7, 1.5, 'saw', attack=0.01)


# ═══════════════════════ СКОР (абсолютные секунды) ═════════════════════
def S1():  # 0.0–15.5 «Подход»
    # вечный тёмный дрон A + расстроенный дубль + саб
    add_tone(0.0, 55, 55, 0.085, 38, 'sine', attack=1.5)
    add_tone(0.0, 55.7, 55.7, 0.05, 38, 'sine', attack=2.0, vib_rate=0.6, vib_dep=0.004)
    add_tone(0.0, 27.5, 27.4, 0.09, 38, 'sine', attack=2.0)
    add_tone(0.0, 110.0, 110.0, 0.022, 38, 'sine', attack=2.5, vib_rate=0.4, vib_dep=0.006)
    add_tone(0.0, 220.0, 220.0, 0.010, 38, 'sine', attack=3.0, vib_rate=0.5, vib_dep=0.008)
    # мрачный пэд (диссонанс: Bb поверх A)
    add_tone(0.0, 116.54, 116.54, 0.02, 38, 'sine', attack=4.0, vib_rate=0.3, vib_dep=0.008)
    add_tone(0.0, 233.08, 233.08, 0.008, 38, 'sine', attack=4.5, vib_rate=0.4, vib_dep=0.01)
    # далёкий ветер
    add_noise(0.0, 6.5, 0.03, lp=0.03, decay_exp=False)
    add_noise(9.0, 6.0, 0.035, lp=0.03, decay_exp=False)

    # сердце: разгон 50→105 bpm, удары-двойняшки
    t = 1.6
    bpm = 50.0
    while t < 15.3:
        vol = 0.16 + 0.12 * (t / 15.5)
        add_kick(t, vol, 75, 42, 0.24)
        add_kick(t + 60 / bpm * 0.30, vol * 0.5, 68, 42, 0.2)
        bpm = 50 + (t / 15.0) * 58
        t += 60.0 / bpm
    # уколы-стаккато
    add_noise(4.0, 0.3, 0.09, hp=1.0, at=0.002)
    add_tone(4.0, 2100, 900, 0.03, 0.4, 'square')
    add_noise(8.2, 0.35, 0.1, hp=1.0, at=0.002)
    add_tone(8.2, 1700, 700, 0.035, 0.45, 'square')
    squeal(11.6, 1.3, 1568, 1760, 0.008, 7.0)
    add_tone(13.0, 880, 940, 0.01, 1.8, 'sine', vib_rate=6.0, vib_dep=0.005)
    # райзер к рубильнику
    add_noise(13.6, 2.1, 0.09, hp=0.0, at=0.4)  # нарастающий
    add_tone(13.9, 60, 260, 0.05, 2.0, 'saw', attack=0.6)
    add_tone(13.9, 30, 70, 0.06, 2.0, 'sine', attack=0.6)


def S2():  # 15.5 рубильник
    boom(15.5, 1.15)
    squeal(16.5, 2.0, 1976, 2349, 0.007, 6.2)


def S3():  # 18.05 глюк
    add_noise(18.05, 0.2, 0.3, hp=1.0, at=0.001)
    add_tone(18.05, 2400, 300, 0.28, 0.3, 'square')
    add_kick(18.05, 0.5, 120, 32, 0.5)
    add_noise(18.17, 0.16, 0.2, hp=1.0, at=0.001)
    add_tone(18.17, 1500, 250, 0.2, 0.22, 'square')
    add_kick(18.5, 0.3, 90, 36, 0.4)
    add_tone(18.5, 900, 200, 0.12, 0.3, 'square')


def S4():  # 18.45 кресло + шаги + райзер
    creak(18.45, 0.075)
    creak(18.85, 0.05)
    for st in (18.95, 19.65, 20.3):
        add_kick(st, 0.32, 70, 40, 0.32)
        add_noise(st, 0.12, 0.05, hp=1.0, at=0.002)
    add_noise(19.9, 1.05, 0.085, at=0.5)
    add_tone(19.9, 70, 280, 0.05, 1.2, 'saw', attack=0.6)
    add_tone(20.3, 40, 90, 0.05, 1.0, 'sine', attack=0.4)


def S5():  # 20.85/21.15 грохот + после
    boom(20.85, 1.25)
    boom(21.15, 0.85)
    squeal(21.4, 2.5, 1865, 2217, 0.008, 5.8)
    add_bell(22.8, 220.0, 0.028, 2.6)


def S6():  # 24.8–28.2 титры (FANTAZIA RP мигает)
    # дрон уже звучит; добавляем сердце 46 bpm + шёпот-воздух
    add_kick(25.7, 0.26, 72, 42, 0.28)
    add_kick(26.02, 0.13, 66, 42, 0.22)
    add_kick(27.0, 0.24, 72, 42, 0.28)
    add_kick(27.32, 0.12, 66, 42, 0.22)
    add_tone(25.7, 55, 32, 0.18, 0.9, 'sine')
    add_tone(27.0, 55, 32, 0.16, 0.9, 'sine')
    add_noise(25.0, 3.0, 0.02, lp=0.02, decay_exp=False)
    add_tone(26.5, 587.33, 587.33, 0.013, 1.8, 'triangle', attack=0.3)


def S7():  # 28.2 перечёркивание
    boom(28.2, 1.0)
    add_tone(28.2, 1500, 380, 0.075, 0.9, 'saw', attack=0.004)  # скрежет
    add_tone(28.2, 233.1, 230.5, 0.022, 1.6, 'triangle')
    add_tone(28.2, 349.23, 349.23, 0.02, 1.2, 'triangle')
    add_tone(28.2, 370.0, 370.0, 0.018, 1.2, 'triangle')
    # тиканье ускоряется 28.55 → 29.8
    tt = 28.55
    gap = 0.34
    while tt < 29.72:
        add_tone(tt, 2400, 1700, 0.013, 0.05, 'square')
        gap *= 0.86
        tt += gap
    # райзер к SECRET
    add_noise(28.95, 0.9, 0.06, at=0.6)
    add_tone(29.05, 80, 320, 0.03, 0.95, 'saw', attack=0.6)
    add_kick(29.78, 0.4, 100, 34, 0.5)


def S8():  # 29.8 SECRET
    for k in range(5):
        add_kick(29.8 + k * 0.5, 0.4 if k % 2 == 0 else 0.3, 85, 40, 0.32)
        add_noise(29.8 + k * 0.5 + 0.28, 0.03, 0.014, hp=1.0, at=0.002)
    for f, v in ((110.0, 0.075), (220.0, 0.05), (261.63, 0.038), (329.63, 0.038), (440.0, 0.02)):
        add_tone(29.8, f, f, v, 2.8, 'sine', attack=0.06)
    for t0n, f, v in ((29.98, 659.26, 0.075), (30.35, 587.33, 0.065), (30.75, 523.25, 0.065),
                      (31.15, 440.0, 0.07), (31.55, 523.25, 0.05)):
        add_tone(t0n, f, f, v, 0.55, 'triangle', attack=0.01)


def S9():  # 32.0 SOON
    boom(32.0, 1.5)
    for f, v in ((110.0, 0.06), (220.0, 0.05), (261.63, 0.045), (329.63, 0.045),
                 (440.0, 0.03), (659.26, 0.016), (880.0, 0.011)):
        add_tone(32.0, f, f, v, 5.2, 'sine', attack=0.03)
    add_noise(32.0, 1.8, 0.10, lp=0.03)
    add_noise(32.0, 0.9, 0.24, hp=1.0, at=0.001)
    # тёмные колокола
    add_bell(33.1, 440.0, 0.035, 3.4)
    add_bell(33.9, 659.26, 0.026, 3.0)
    add_bell(34.7, 880.0, 0.022, 2.8)
    add_bell(35.5, 554.37, 0.014, 3.2)
    add_tone(35.0, 55, 27.5, 0.3, 3.4, 'sine', attack=0.3)
    squeal(36.2, 1.7, 1760, 1976, 0.005, 6.0)


S1(); S2(); S3(); S4(); S5(); S6(); S7(); S8(); S9()

# мягкий мастер-фейд с 36.3
for i in range(N):
    t = i / SR
    if t > 36.3:
        k = max(0.0, 1.0 - (t - 36.3) / 2.0)
        buf[i] *= k

# ── запись ──
peak = max(abs(v) for v in buf) or 1.0
k = 0.93 / peak
with wave.open('trailer-full-ost.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v * k)) * 32767)
        frames += struct.pack('<h', s)
    w.writeframes(bytes(frames))
print(f'trailer-full-ost.wav: {DUR:.2f} c, peak={peak:.3f}')

try:
    import lameenc
    with wave.open('trailer-full-ost.wav', 'rb') as f:
        sr = f.getframerate()
        ch = f.getnchannels()
        data = f.readframes(f.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(sr)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open('trailer-full-ost.mp3', 'wb') as f:
        f.write(enc.encode(data) + enc.flush())
    print('trailer-full-ost.mp3: OK')
except ImportError:
    print('lameenc нет — mp3 пропущен')
