#!/usr/bin/env python3
"""Browser-upload package: the complete web runtime, strictly fewer than 100 files.
Tests, development docs, native wrappers and Blender tools stay in the full release.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dropbox' / 'Fantazia-RP-v24-WEB-upload.zip'
PREFIX = 'Fantazia-RP-v24-WEB/'
ROOT_FILES = {'server.js', 'package.json', 'package-lock.json', '.gitignore'}


def main():
    names = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT
    ).decode().split('\0')
    payload = {}
    for name in sorted(set(names)):
        p = Path(name)
        if not name or p.is_absolute() or '..' in p.parts:
            continue
        if name not in ROOT_FILES and p.parts[0] not in {'public', 'server'}:
            continue
        source = ROOT / p
        if source.is_file() and not source.is_symlink():
            payload[name] = source.read_bytes()
    assert ROOT_FILES.issubset(payload)
    assert {'public/index.html', 'server/sky-access.js',
            'public/assets/fz-journey.js', 'public/assets/fz-sky-neon.js', 'public/assets/fz-opening-avatar.js', 'public/assets/fz-sky-visual.js', 'public/assets/fz-sky-garden.js', 'public/styles/fz-v19.css', 'public/styles/fz-neon.css', 'public/vendor/three-r128.min.js',
            'public/assets/fz-letter-portal.js', 'public/fonts/helvetiker_bold.typeface.json',
            'public/fonts/LICENSE-Helvetiker.txt', 'public/assets/fz-flash-grip.js',
            'public/assets/fz-metro.js', 'public/assets/fz-metro-policy.js',
            'public/assets/fz-metro-audio.js', 'public/styles/fz-lobby23.css',
            'public/assets/fz-sound.js', 'public/styles/fz-sound.css'}.issubset(payload)
    assert all(f'public/audio/metro/{s}.mp3' in payload for s in
               ['center', 'factory', 'park', 'port', 'business', 'close', 'arrival'])
    assert all(f'public/audio/city/{s}.mp3' in payload for s in ['welcome', 'sky', 'city', 'credit'])
    assert all(f'public/audio/music/{s}.wav' in payload for s in ['neon-route', 'above-clouds', 'last-train'])
    payload['README-UPLOAD.txt'] = (
        'FANTAZIA RP 3D v24 — вся браузерная игра, пакет для загрузки через сайт\n\n'
        '1. Распакуй этот ZIP в НОВУЮ отдельную папку. Не смешивай с полным архивом.\n'
        '2. Открой Fantazia-RP-v24-WEB: внутри видны public, server и package.json.\n'
        '3. На странице загрузки файлов GitHub убери старый незавершённый список.\n'
        '4. Перетащи СОДЕРЖИМОЕ этой папки, включая public и server, в корень репозитория.\n'
        '   Не загружай сам ZIP и не внешнюю папку Fantazia-RP-v24-WEB.\n'
        '   package.json должен лежать в корне рядом с server.js.\n\n'
        'Из игры ничего не удалено. Исключены только тесты, документы разработчика,\n'
        'инструменты Blender и исходные APK/EXE-оболочки. Godot и node_modules отсутствуют.\n'
        'Полный архив v24 остаётся отдельной копией исходников.\n\n'
        'Запуск на ПК: Node.js 22 LTS, затем npm ci и npm start.\n'
        'Адрес: http://localhost:3000. Один GitHub Pages не запускает Node.js-сервер.\n'
        'Загрузка файлов в репозиторий сама по себе не подтверждает развёртывание сайта.\n'
        'Сохранённые места/прогулки находятся в браузере, не в этом ZIP.\n'
    ).encode('utf-8')
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
    payload['CHECKSUMS.json'] = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
    assert len(payload) < 100, f'Browser upload limit: {len(payload)} files'
    assert max(map(len, payload.values())) < 25 * 1024 * 1024
    DEST.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(DEST, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in payload.items():
            archive.writestr(PREFIX + name, data)
    with zipfile.ZipFile(DEST) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(payload)
        for name, digest in manifest.items():
            assert hashlib.sha256(archive.read(PREFIX + name)).hexdigest() == digest
    print(f'{DEST}\n{len(payload)} files, {DEST.stat().st_size} bytes; CRC/SHA256 verified')
    print(f'Complete web runtime: {sum(n.startswith(("public/", "server/")) for n in payload)} files')


if __name__ == '__main__':
    main()
