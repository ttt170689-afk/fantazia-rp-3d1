#!/usr/bin/env bash
# Test commands only: never use this logger for signing or commands containing secrets.
set -uo pipefail
mkdir -p build/ci-logs
log="build/ci-logs/$(date +%s)-check.log"
status=0
"$@" > "$log" 2>&1 || status=$?
cat "$log"
if [ "$status" -ne 0 ]; then
  python3 - "$log" <<'PY'
import pathlib,sys
text='\n'.join(pathlib.Path(sys.argv[1]).read_text(errors='replace').splitlines()[-65:])[-14000:]
print('::error title=Android build or test failed::'+text.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
for report in pathlib.Path('build/intermediates/lint_intermediate_text_report').glob('**/*.txt'):
    excerpt=report.read_text(errors='replace')[:18000]
    print('::error title=Android lint details::'+excerpt.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
PY
fi
exit "$status"
