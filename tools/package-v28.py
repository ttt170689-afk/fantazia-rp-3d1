#!/usr/bin/env python3
"""Build one complete source ZIP from this working tree, including untracked code.

No push/deploy, no previous archive overwrite, no personal accounts or credentials.
The manifest covers every payload file and is verified by re-reading the ZIP.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "Fantazia-RP-v28/"
DEFAULT = ROOT / "dropbox" / "Fantazia-RP-v28-Interiors-Cranes.zip"
SKIP_DIRS = {
    ".git", ".arena", "node_modules", "godot", "dropbox", "release",
    "reports", "coverage", ".cache", "__pycache__", ".venv",
}
SKIP_NAMES = {"accounts.json", "shop-users.json", ".netrc", ".git-credentials"}
SKIP_EXTENSIONS = {".zip", ".log", ".jks", ".keystore", ".pem", ".key", ".p12", ".pfx", ".db", ".sqlite"}
REQUIRED = {
    "server.js", "package.json", "package-lock.json", "public/index.html",
    "server/sky-access.js", "public/exports/player_super.glb",
    "public/assets/fz-building-policy.js", "public/assets/fz-building-kit.js",
    "public/assets/fz-building-details.js", "public/assets/fz-building-layouts.js",
    "public/assets/fz-buildings.js", "public/assets/fz-building-directory.js",
    "public/assets/fz-cinema-film.js", "public/assets/fz-cranes.js",
    "public/assets/fz-residence-tasks.js", "public/styles/fz-buildings.css",
    "public/assets/fz-loading-dancer.js", "public/assets/fz-metro.js",
    "public/assets/fz-opening-avatar.js", "public/assets/fz-sky.js",
    "docs/UPDATE-V28.md", "tests/buildings28.test.cjs",
    "tests/buildings28.browser.test.cjs", "tests/cranes28.test.cjs",
    "tests/film28.test.cjs", "tests/residence28.test.cjs",
    "tools/verify-release.cjs",
}


def admissible(name: str) -> bool:
    path = Path(name)
    if not name or path.is_absolute() or ".." in path.parts:
        return False
    if SKIP_DIRS.intersection(part.lower() for part in path.parts):
        return False
    if path.name in SKIP_NAMES or path.name.startswith(".env"):
        return False
    return path.suffix.lower() not in SKIP_EXTENSIONS


def collect() -> dict[str, bytes]:
    candidates = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
    ).decode().split("\0")
    payload = {}
    for name in sorted(set(candidates)):
        if not admissible(name):
            continue
        source = ROOT / name
        if source.is_file() and not source.is_symlink():
            payload[name] = source.read_bytes()
    missing = REQUIRED - payload.keys()
    assert not missing, f"Missing required files: {sorted(missing)}"
    html = payload["public/index.html"].decode()
    for raw in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', html):
        path = raw.split("?")[0].split("#")[0]
        if path.startswith(("assets/", "styles/", "vendor/", "fonts/", "exports/")):
            assert "public/" + path in payload, f"Missing HTML dependency: {path}"
    return payload


def readme() -> bytes:
    return """FANTAZIA RP 3D — v28 — 23.10.2026
ПОЛНАЯ БРАУЗЕРНАЯ ИГРА, НЕ ТОЛЬКО ПАТЧ

Распакуйте архив в новую отдельную папку.
В Fantazia-RP-v28 лежат server.js, package.json и папка public.
Не открывайте index.html двойным щелчком: нужен локальный сервер.

Запуск на ПК с Node.js 22 LTS:
  npm ci
  npm start
  Откройте http://localhost:3000

В меню игры: «Здания и краны — пешие маршруты».
Дома: 2 или 4 этажа, подъезд, консьержка, лестницы, лифт,
нумерованные квартиры, двери, мебель, шторы, свет, урны и стирка.
Кино: кинобар, игровые покупки, 2 зала по 30 кресел,
2 коротких локальных 3D-фильма и пауза показа.
Банк: очередь, операционисты, консультации и прежний игровой счёт.
Суд: канцелярия, 2 зала и 3 игровых слушания.
Также обновлены кабинеты больницы/офиса.
Краны: лестница, высота 28 м, ограждённая стрела и управление крюком.

ПК: E — действие, W/S — подъём/спуск по лестнице крана.
Телефон: «Действие» и экранные кнопки подъёма/спуска.
Этажи в новых зданиях меняются лестницей или движущимся лифтом.
Старый город и GRAND MALL не удалены. Заставка остаётся 7 секунд.

Godot, node_modules, личные аккаунты, .env и ключи не включены.
Это исходники, не готовые APK/EXE. Обёртки в apps — тоже исходники.
Перед обновлением существующего сервера отдельно сохраните его БД.
Новые предметы/чеки/поручения хранятся локально в браузере,
по профилю и зданию; ZIP не переносит эти сохранения.
Новые RP-действия не являются серверной защищённой экономикой.

Описание: docs/UPDATE-V28.md
Тесты: npm ci --prefix tests, затем npm test --prefix tests
Проверка распакованной копии после npm ci:
  node tools/verify-release.cjs .
CHECKSUMS.json содержит SHA256 каждого файла кроме самого списка.
Никакой публикации на GitHub или развёртывания эта сборка не выполняет.
""".encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT)
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination.exists():
        raise SystemExit(f"Refusing to overwrite an existing archive: {destination}")
    payload = collect()
    payload["README-ARCHIVE-RU.txt"] = readme()
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
    payload["CHECKSUMS.json"] = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in payload.items():
            archive.writestr(PREFIX + name, data)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None, "CRC failure"
        assert len(archive.namelist()) == len(payload)
        for name, digest in manifest.items():
            assert hashlib.sha256(archive.read(PREFIX + name)).hexdigest() == digest
        assert all(admissible(name.removeprefix(PREFIX)) for name in archive.namelist())
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    print(json.dumps({"path": str(destination), "files": len(payload),
                      "bytes": destination.stat().st_size, "sha256": digest,
                      "crc": "PASS", "manifest": "PASS"}, indent=2))


if __name__ == "__main__":
    main()
