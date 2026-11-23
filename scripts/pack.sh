#!/usr/bin/env bash
# Builds dist/lampyris-<version>-chrome.zip and dist/lampyris-<version>-firefox.zip from extension/.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
mkdir -p dist
for TARGET in chrome firefox; do
  TMP=$(mktemp -d)
  cp -r extension/. "$TMP/"
  python3 - "$TMP/manifest.json" "$TARGET" <<'PY'
import json, sys
path, target = sys.argv[1], sys.argv[2]
m = json.load(open(path))
# extension/manifest.json is written for Chromium; the Firefox build gets Firefox's background
# page, its add-on ID and the data-collection declaration AMO requires.
if target == "firefox":
    m.pop("minimum_chrome_version", None)
    m["background"] = {"scripts": [m["background"]["service_worker"]]}
    for w in m.get("web_accessible_resources", []): w.pop("use_dynamic_url", None)
    m["browser_specific_settings"] = {"gecko": {
        "id": "lampyris@lampyris-peek",
        "strict_min_version": "140.0",
        "data_collection_permissions": {"required": ["none"]},
    }}
json.dump(m, open(path, "w"), ensure_ascii=False, indent=2)
PY
  OUT="dist/lampyris-${VERSION}-${TARGET}.zip"
  rm -f "$OUT"
  (cd "$TMP" && zip -qr "$OLDPWD/$OUT" . -x '.*' '*/.*')
  rm -r "$TMP"
  echo "→ $OUT"
done
