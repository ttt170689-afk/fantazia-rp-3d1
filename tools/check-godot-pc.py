#!/usr/bin/env python3
"""Read-only checks for the separate Godot PC prototype. Standard library only."""
import hashlib
import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parents[1]
PROJECT = REPO / "godot-pc"


def verify(project: Path = PROJECT, check_sources: bool = True) -> dict:
    project = project.resolve()
    required = [
        "project.godot", "scenes/main.tscn", "scripts/world.gd",
        "scenes/latest_world.tscn", "scripts/latest_world.gd", "scripts/metro05.gd",
        "tests/latest05.gd", "tests/latest_assets05.gd", "UPDATE-05.md",
        "assets/world-v28.json", "assets/web-source05.json",
        "assets/city_v28.scn", "assets/sky_v28.scn", "assets/sea_v28.scn",
        "scenes/world.tscn", "scenes/main_menu.tscn", "scripts/main_menu.gd",
        "scripts/ui_theme.gd", "ui/native_theme.tres", "scripts/menu_backdrop.gd",
        "scripts/launch_log.gd", "tests/launcher03.gd", "STYLE-MIGRATION.md", "UPDATE-03.md",
        "assets/city.scn", "assets/player.scn", "assets/baked-manifest.json",
        "source_models/.gdignore", "tests/native04.gd", "UPDATE-04.md",
        "scripts/player.gd", "scripts/residence.gd", "scripts/lift.gd",
        "scripts/door.gd", "scripts/assets.gd", "scripts/hud.gd",
        "scripts/interaction.gd", "scripts/kit.gd", "tests/test_prototype.gd",
        "scripts/profile.gd", "scripts/options_panel.gd", "tests/upgrade02.gd", "UPDATE-02.md",
        "README-RU.md", "VERIFICATION.md", "export_presets.cfg",
        "assets/provenance.json", "source_models/city.glb", "source_models/player.glb",
    ]
    for relative in required:
        assert (project / relative).is_file(), f"Missing {relative}"
    reference_count = 0
    for p in project.rglob("*"):
        if ".godot" in p.parts or "exports" in p.parts:
            continue
        assert not p.is_symlink(), f"Unexpected symlink: {p}"
        if p.suffix not in {".gd", ".tscn", ".godot"}:
            continue
        for relative in re.findall(r'res://([^"\s]+)', p.read_text()):
            assert ".." not in Path(relative).parts, f"Escaping reference: {relative}"
            assert (project / relative).is_file() or (relative.endswith("/") and (project / relative).is_dir()), f"Broken reference {relative} in {p.name}"
            reference_count += 1
    assets = json.loads((project / "assets/provenance.json").read_text())
    for filename, info in assets.items():
        local = project / "source_models" / filename
        digest = hashlib.sha256(local.read_bytes()).hexdigest()
        assert digest == info["sha256"], f"Changed imported model: {filename}"
        assert local.stat().st_size == info["bytes"], filename
        assert local.read_bytes()[:4] == b"glTF", f"Not a GLB: {filename}"
        if check_sources and info.get("kind") == "web_scene_capture":
            capture = json.loads((project / info["source_manifest"]).read_text())
            for name, expected in capture["inputs"].items():
                assert hashlib.sha256((REPO / name).read_bytes()).hexdigest() == expected, name
        elif check_sources:
            source = REPO / info["source"]
            assert hashlib.sha256(source.read_bytes()).hexdigest() == digest, filename
    baked = json.loads((project / "assets/baked-manifest.json").read_text())
    assert set(baked["models"]) == {f"res://assets/{name}.scn" for name in ["city", "player", "city_v28", "sky_v28", "sea_v28"]}
    for resource, info in baked["models"].items():
        raw = (project / resource.removeprefix("res://")).read_bytes()
        assert raw[:4] in (b"RSCC", b"RSRC"), resource
        assert len(raw) == info["bytes"], resource
        assert hashlib.sha256(raw).hexdigest() == info["sha256"], resource
        assert info["external_dependencies"] == 0, resource
        source_name = Path(resource).stem + ".glb"
        assert info["source_sha256"] == assets[source_name]["sha256"], resource
    visible_imports = []
    def scan(folder):
        if (folder / ".gdignore").exists():
            return
        for path in folder.iterdir():
            if path.name.startswith(".") or path.name == "exports":
                continue
            if path.is_dir():
                scan(path)
            elif path.suffix.lower() in {".glb", ".gltf", ".blend", ".fbx", ".png", ".jpg", ".svg", ".wav", ".ogg"}:
                visible_imports.append(path.relative_to(project).as_posix())
            elif path.suffix == ".import":
                raise AssertionError(f"Unexpected importer recipe: {path}")
    scan(project)
    assert not visible_imports, visible_imports
    for script in (project / "scripts").glob("*.gd"):
        assert "GLTFDocument" not in script.read_text(), script
    config = (project / "project.godot").read_text()
    assert 'run/main_scene="res://scenes/main_menu.tscn"' in config
    assert 'renderer/rendering_method="gl_compatibility"' in config
    return {"ok": True, "required_files": len(required), "references": reference_count,
            "verified_source_models": len(assets), "native_models": len(baked["models"]),
            "visible_import_sources": visible_imports}


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJECT
    print(json.dumps(verify(path, check_sources=len(sys.argv) == 1), ensure_ascii=False))
