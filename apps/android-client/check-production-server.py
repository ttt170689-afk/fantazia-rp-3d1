"""Bounded, read-only check of the owner's production server, run on GitHub CI."""
import json
import os
from pathlib import Path
import time
import urllib.request

BASE = "https://fantazia-rp-3d1.onrender.com/"
report = {"server": BASE, "ok": False, "checks": {}}
output = Path("build/reports/production-server.json")
output.parent.mkdir(parents=True, exist_ok=True)


def get(path, limit):
    request = urllib.request.Request(BASE + path, headers={"User-Agent": "Fantazia-Android-connection-check/1.0.2"})
    with urllib.request.urlopen(request, timeout=40) as response:
        if not response.url.startswith(BASE):
            raise ValueError("Unexpected redirect away from the production origin")
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Response exceeds expected size")
        return data


try:
    for attempt in range(3):
        try:
            health = json.loads(get("api/health", 16384))
            if health.get("ok") is not True or health.get("name") != "Fantazia RP 3D":
                raise ValueError("Not a Fantazia RP 3D health response")
            report["checks"]["health"] = True
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)
    page = get("", 2_000_000).decode("utf-8")
    if "fantazia" not in page.lower() or "<html" not in page.lower():
        raise ValueError("Game HTML was not returned")
    report["checks"]["game_html"] = True
    report["ok"] = True
    print("::notice::Production Render health and game HTML PASS: " + BASE)
except Exception as error:
    report["error"] = str(error)
    print("::warning::Production server connection check failed; see production-server.json")
finally:
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write("\n## Production server check\n```json\n" + json.dumps(report, ensure_ascii=False, indent=2) + "\n```\n")
if not report["ok"]:
    raise SystemExit(1)
