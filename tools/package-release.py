#!/usr/bin/env python3
"""Make a source-only delivery ZIP from this working tree; never include Godot or local data."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dropbox' / 'Fantazia-RP-v24-no-Godot.zip'
PREFIX = 'Fantazia-RP-v24/'
FORBIDDEN = {'.git', 'node_modules', 'godot', 'dropbox', 'reports', 'release'}


def main():
    files = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT
    ).decode().split('\0')
    payload = {}
    for name in sorted(set(files)):
        path = Path(name)
        if not name or path.is_absolute() or '..' in path.parts:
            continue
        if FORBIDDEN.intersection(part.lower() for part in path.parts):
            continue
        if path.suffix.lower() in {'.zip', '.log', '.jks', '.keystore'}:
            continue
        if path.name.startswith('.env') or path.name in {'accounts.json', 'shop-users.json'}:
            continue
        source = ROOT / path
        if source.is_file() and not source.is_symlink():
            payload[name] = source.read_bytes()
    required = {'public/index.html', 'server.js', 'public/assets/fz-journey.js', 'public/assets/fz-sky-neon.js', 'public/assets/fz-opening-avatar.js',
                'public/assets/fz-motion.js', 'docs/UPDATE-V24.md', 'tools/generate-soundtrack.py',
                'public/assets/fz-sound.js', 'public/audio/music/neon-route.wav'}
    assert required.issubset(payload), 'Incomplete source tree'
    payload['README-ARCHIVE.txt'] = (
        'FANTAZIA RP 3D — v24, 22.10.2026\n'
        'Браузерная игра. Godot, node_modules, аккаунты и секреты НЕ включены.\n'
        'Распакуй архив в отдельную папку. Node.js 22 LTS: npm ci, затем npm start.\n'
        'Открой http://localhost:3000. Не открывай index.html двойным щелчком.\n'
        'Новое: музыка, четыре реплики, SFX, атмосфера и звуковой микшер; детали — docs/UPDATE-V24.md.\n'
        'Журнал сохраняется в браузере; полный игровой прогресс и аккаунты не переносятся.\n'
        'APK/EXE в apps/ — исходные оболочки, не готовые установщики.\n'
        'CHECKSUMS.json содержит SHA256 каждого файла, кроме самого списка.\n'
    ).encode()
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
    payload['CHECKSUMS.json'] = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
    DEST.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(DEST, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in payload.items():
            archive.writestr(PREFIX + name, data)
    with zipfile.ZipFile(DEST) as archive:
        assert archive.testzip() is None
        for name, digest in manifest.items():
            assert hashlib.sha256(archive.read(PREFIX + name)).hexdigest() == digest
        assert not any('godot' in Path(name).parts for name in archive.namelist())
    print(f'{DEST}\n{len(payload)} files; {DEST.stat().st_size} bytes; CRC and SHA256 verified')


if __name__ == '__main__':
    main()
