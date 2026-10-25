#!/usr/bin/env python3
"""Package only the standalone native prototype; never include web accounts/secrets."""
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "godot-pc"
OUT = ROOT / "dropbox/Fantazia-Godot-PC-Prototype-05-Latest-World-Metro.zip"
PREFIX = "Fantazia-Godot-PC-05"
ALLOWED_SUFFIXES = {".scn", ".cmd", ".gd", ".uid", ".tres", ".import", ".tscn", ".godot", ".cfg", ".svg", ".glb", ".json", ".md", ".txt"}


def main() -> None:
    spec = importlib.util.spec_from_file_location("prototype_check", ROOT / "tools/check-godot-pc.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checks = module.verify()
    stamp = json.loads((PROJECT / "tests/VERIFIED-05.json").read_text())
    assert stamp["version"] == "0.5.0" and stamp["automatic_imports"] == 0
    assert stamp["editor_clean_copy"] and stamp["runtime_without_glbs"]
    for result in stamp["tests"].values():
        assert result["failures"] == 0
    test_spec = importlib.util.spec_from_file_location("release05", ROOT / "tools/test-godot-release05.py")
    test_module = importlib.util.module_from_spec(test_spec)
    test_spec.loader.exec_module(test_module)
    assert stamp["files"] == test_module.source_snapshot(PROJECT), "Source changed after verification"

    if OUT.exists():
        raise SystemExit(f"Refusing to replace an existing delivered archive: {OUT}")
    records = {}
    files = []
    for p in sorted(PROJECT.rglob("*")):
        relative = p.relative_to(PROJECT)
        if any(part in {".godot", "exports", ".git", "__pycache__"} for part in relative.parts):
            continue
        # Editor-extracted duplicates are regenerated from the unchanged GLBs.
        if re.fullmatch(r"assets/(city|player)_\d+\.png(?:\.import)?", relative.as_posix()):
            continue
        if p.is_symlink():
            raise SystemExit(f"Refusing symlink {relative}")
        if not p.is_file():
            continue
        if p.suffix not in ALLOWED_SUFFIXES and p.name not in {".gitignore", ".gdignore"}:
            raise SystemExit(f"Unreviewed file type {relative}")
        if p.name.startswith(".env") or p.name in {"accounts.json", "users.json", "settings.cfg", "prototype-profile.json", "world05-profile.json", "launch-state.json", "diagnostics.txt"}:
            raise SystemExit(f"Private data must not ship: {relative}")
        raw = p.read_bytes()
        records[str(relative)] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
        files.append((relative, raw))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"name": "Fantazia Godot PC prototype", "version": "0.5.0", "files": records}
    with zipfile.ZipFile(OUT, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for relative, raw in files:
            z.writestr(f"{PREFIX}/{relative.as_posix()}", raw)
        z.writestr(f"{PREFIX}/CHECKSUMS.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with zipfile.ZipFile(OUT) as z:
        assert z.testzip() is None, "Archive CRC failure"
        for relative, record in records.items():
            data = z.read(f"{PREFIX}/{relative}")
            assert hashlib.sha256(data).hexdigest() == record["sha256"], relative
    print(json.dumps({"archive": str(OUT), "files": len(files) + 1,
                      "bytes": OUT.stat().st_size,
                      "sha256": hashlib.sha256(OUT.read_bytes()).hexdigest(),
                      "checks": checks}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
