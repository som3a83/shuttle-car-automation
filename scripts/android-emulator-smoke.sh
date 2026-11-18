#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE must be provided by the workflow}"
APK="$WORKSPACE/android/app/build/outputs/apk/debug/app-debug.apk"
EVIDENCE="$WORKSPACE/artifacts/android-smoke"

if [[ ! -d "$WORKSPACE/android/app" ]]; then
  echo "::error::Generated Android project not found under $WORKSPACE"
  exit 1
fi
if [[ ! -s "$APK" ]]; then
  echo "::error::Debug APK not found: $APK"
  find "$WORKSPACE/android/app/build/outputs" -maxdepth 5 -type f -print || true
  exit 1
fi

mkdir -p "$EVIDENCE"
echo "Repository workspace: $WORKSPACE"
adb wait-for-device
adb shell wm size | tee "$EVIDENCE/display-size.txt"
adb shell wm density | tee "$EVIDENCE/display-density.txt"
adb install -r "$APK"
adb logcat -c
adb shell am force-stop com.shuttlecar.automation
adb shell am start -W -n com.shuttlecar.automation/.MainActivity | tee "$EVIDENCE/launch-result.txt"
grep -F "Status: ok" "$EVIDENCE/launch-result.txt"

# Allow the WebView and the verified local-storage bootstrap to finish on slower CI emulators.
sleep 25
APP_PID="$(adb shell pidof com.shuttlecar.automation | tr -d '\r' || true)"
if [[ -z "$APP_PID" ]]; then
  echo "::error::Application process exited after launch."
  exit 1
fi

adb exec-out screencap -p > "$EVIDENCE/android-app-screen.png"
test -s "$EVIDENCE/android-app-screen.png"

# Dismiss the emulator's optional system "Pixel Launcher isn't responding" prompt if one
# appeared during cold start. On a healthy emulator this tap only lands on the dashboard body.
adb shell input tap 320 1360 || true
sleep 2

# Exercise the Engineering Visualization destination from the visible mobile navigation.
# The workflow uses a 1080x2400 portrait emulator; this targets the third quick-navigation tile.
adb shell input tap 545 445
sleep 8
adb exec-out screencap -p > "$EVIDENCE/engineering-app-screen.png"
test -s "$EVIDENCE/engineering-app-screen.png"

# Exercise the Battery Management destination and capture the newly interactive
# internal battery assembly. Use Android accessibility text rather than fixed
# sidebar coordinates so the check survives layout and language refinements.
adb shell input tap 52 150
sleep 3
adb shell uiautomator dump /sdcard/shuttle-battery-navigation.xml >/dev/null 2>&1
adb shell cat /sdcard/shuttle-battery-navigation.xml > "$EVIDENCE/battery-navigation-ui.xml"
BATTERY_NAV_COORDS="$(python3 - "$EVIDENCE/battery-navigation-ui.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
try:
    root = ET.parse(path).getroot()
except (ET.ParseError, OSError):
    raise SystemExit(1)

labels = ("Battery Management", "إدارة البطاريات")
for node in root.iter("node"):
    text = node.attrib.get("text", "")
    description = node.attrib.get("content-desc", "")
    if any(label in text or label in description for label in labels):
        match = re.search(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            raise SystemExit(0)
raise SystemExit(1)
PY
)" || {
  echo "::error::Battery Management was not discoverable in the Android accessibility tree."
  cat "$EVIDENCE/battery-navigation-ui.xml"
  exit 1
}
read -r BATTERY_X BATTERY_Y <<< "$BATTERY_NAV_COORDS"
adb shell input tap "$BATTERY_X" "$BATTERY_Y"
sleep 10
adb exec-out screencap -p > "$EVIDENCE/battery-app-screen.png"
test -s "$EVIDENCE/battery-app-screen.png"

# Capture the exploded battery assembly when the control is exposed to accessibility.
adb shell uiautomator dump /sdcard/shuttle-battery-viewer.xml >/dev/null 2>&1
adb shell cat /sdcard/shuttle-battery-viewer.xml > "$EVIDENCE/battery-viewer-ui.xml"
EXPLODE_COORDS="$(python3 - "$EVIDENCE/battery-viewer-ui.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

try:
    root = ET.parse(sys.argv[1]).getroot()
except (ET.ParseError, OSError):
    raise SystemExit(1)

for node in root.iter("node"):
    text = node.attrib.get("text", "")
    description = node.attrib.get("content-desc", "")
    if "Explode battery assembly" in text or "Explode battery assembly" in description:
        match = re.search(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            raise SystemExit(0)
raise SystemExit(1)
PY
)" || true
if [[ -n "$EXPLODE_COORDS" ]]; then
  read -r EXPLODE_X EXPLODE_Y <<< "$EXPLODE_COORDS"
  adb shell input tap "$EXPLODE_X" "$EXPLODE_Y"
  sleep 3
  adb exec-out screencap -p > "$EVIDENCE/battery-exploded-screen.png"
  test -s "$EVIDENCE/battery-exploded-screen.png"
fi

adb shell dumpsys activity activities > "$EVIDENCE/activities.txt"
grep -F "com.shuttlecar.automation/.MainActivity" "$EVIDENCE/activities.txt"
adb logcat -d -t 5000 > "$EVIDENCE/device-logcat.txt"
if grep -E "FATAL EXCEPTION|Process: com\\.shuttlecar\\.automation" "$EVIDENCE/device-logcat.txt"; then
  echo "::error::Android application crash detected in logcat."
  exit 1
fi

echo "Android emulator install, launch, foreground-process, screenshot, and crash-log checks passed."
