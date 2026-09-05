#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
😈 ИМБОВЫЕ ЗВУКИ ДЛЯ ТИЗЕРА:
  1) СЕРДЦЕБИЕНИЕ — мощный луб-дуб (удар 90→28 Гц, два толчка)
  2) ХИХИКАНЬЕ/СМЕХ БОССА — партия из 5 жутких хохотков (нисходящие, с хрипотой)
"""
import numpy as np
import wave
import math

SR = 48000

def env_ad(n, at, rel, curve=1.0):
    t = np.arange(n) / SR
    a = np.minimum(1, t / at)
    r = np.clip(1 - (t - (n / SR - rel)) / rel, 0, 1)
    return a * r

def render(name, mono, vol=0.95):
    mono = np.asarray(mono, dtype=np.float64)
    peak = np.max(np.abs(mono)) or 1.0
    mono = mono / peak * vol
    pcm = (mono * 32767).astype('<i2')
    with wave.open(name, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, f'{len(mono)/SR:.2f}s')

rng = np.random.default_rng(7)

# ── 💓 СЕРДЦЕБИЕНИЕ: ЛУБ-ДУБ ──
def heart_lub(t):
    # низкий удар со свипом вниз + щелчок
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    f = 28 + 62 * np.exp(-tt / 0.07)      # 90 → 28 Гц
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-tt / 0.16)
    # щелчок
    c = rng.standard_normal(int(0.02 * SR))
    c = np.diff(c, prepend=0) * np.exp(-np.arange(len(c)) / SR / 0.006)
    sig[:len(c)] += c * 0.5
    return sig

def heart_dub(t):
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    f = 30 + 50 * np.exp(-tt / 0.06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-tt / 0.13)
    c = rng.standard_normal(int(0.015 * SR))
    c = np.diff(c, prepend=0) * np.exp(-np.arange(len(c)) / SR / 0.006)
    sig[:len(c)] += c * 0.35
    return sig

def heart_beat_full(bpm=80):
    """Один цикл сердцебиения (луб-дуб) + пауза."""
    beat = np.zeros(int(2.0 * SR))
    lub = heart_lub(0)
    dub = heart_dub(0)
    beat[:len(lub)] += lub * 0.9
    # дуб через 0.28с
    s = int(0.28 * SR)
    beat[s:s + len(dub)] += dub * 0.6
    return beat

hb = heart_beat_full()
# 4 удара с ускорением и нарастанием громкости (как приближение к боссу)
hb_all = np.zeros(int(7.0 * SR))
intervals = [0.0, 1.05, 1.95, 2.75]  # ускорение
for i, t0 in enumerate(intervals):
    vol = 0.6 + i * 0.12
    s = int(t0 * SR)
    hb_all[s:s + len(hb)] += hb * vol
# финальный мощный удар
last = heart_beat_full()
s = int(3.45 * SR)
hb_all[s:s + len(last)] += last * 1.1
# обрезать по финальному удару
hb_all = hb_all[:int(4.6 * SR)]
# лёгкий фейд в конце
hb_all[-int(0.3*SR):] *= np.linspace(1, 0, int(0.3*SR))
render('heartbeat-imba.wav', hb_all, 0.95)

# ── 😈 ХИХИКАНЬЕ БОССА (жуткий смех) ──
def boss_cackle(t0_total, n_laughs=5, vol=0.8):
    """Серия хохотков: каждый = быстрый нисходящий визг + хриплый низкий удар.
    Общий звук: жуткое, но «весёлое» хихиканье босса."""
    total = np.zeros(int((t0_total + 3.2) * SR))
    # низкий зловещий тон-основа (голос «из бочки»)
    n0 = int(0.0 * SR)
    tt = np.arange(len(total)) / SR
    low_base = np.sin(2 * np.pi * 78 * tt) * np.exp(-tt / 1.8)
    low_base *= env_ad(len(total), 0.15, 1.0)
    total += low_base * 0.12
    for i in range(n_laughs):
        t0 = t0_total + i * 0.34
        s0 = int(t0 * SR)
        dur = 0.30 + (i % 3) * 0.02
        n = int(dur * SR)
        tt = np.arange(n) / SR
        # частота хохотка: 900→450 Гц + вибрато (как «хи-хи-хи»)
        f0 = 880 - i * 40
        f = (f0 - 380 * (tt / dur)) * (1 + 0.22 * np.sin(2 * np.pi * 9 * tt))
        ph = 2 * np.pi * np.cumsum(f) / SR
        # смесь пилы и синуса = гнусавый голос
        squeal = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
        squeal *= env_ad(n, 0.004, 0.05)
        # хрипотца: шум с амплитудной модуляцией
        noise = rng.standard_normal(n)
        noise *= (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 12 * tt))) * env_ad(n, 0.005, 0.06)
        laugh = squeal * 0.5 + noise * 0.35
        if s0 + n <= len(total):
            total[s0:s0 + n] += laugh * vol
        # «смешок-удар» после каждого хихиканья
        if i > 0:
            sub_s = int((t0 + 0.12) * SR)
            ns = int(0.25 * SR)
            tts = np.arange(ns) / SR
            fsub = 40 + 60 * np.exp(-tts / 0.05)
            phs = 2 * np.pi * np.cumsum(fsub) / SR
            sub = np.sin(phs) * np.exp(-tts / 0.1)
            if sub_s + ns <= len(total):
                total[sub_s:sub_s + ns] += sub * 0.5 * vol
    return total

cackle = boss_cackle(0.3, 5, 0.85)
render('boss-cackle-imba.wav', cackle, 0.9)

# ── 😈 Полная версия: сердце → тишина → ХИХИКАНЬЕ → глаза ──
DUR2 = 9.5
combo = np.zeros(int(DUR2 * SR))
combo[:len(hb_all)] = hb_all * 0.9
# тишина 0.8с, затем ХИХИКАНЬЕ
ca_s = 3.6
ca = boss_cackle(0.0, 6, 0.95)
s = int(ca_s * SR)
e = min(len(combo), s + len(ca))
combo[s:e] += ca[:e - s]
# финальный «глаза» акцент
n_end = int(1.0 * SR)
tt = np.arange(n_end) / SR
flash = np.sin(2 * np.pi * 1200 * tt) * np.exp(-tt / 0.08) * 0.2
s = int(8.2 * SR)
e = min(len(combo), s + n_end)
combo[s:e] += flash[:e - s]
render('boss-scene-imba.wav', combo, 0.95)
print('Готово!')
