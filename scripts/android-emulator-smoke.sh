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
sleep 20
APP_PID="$(adb shell pidof com.shuttlecar.automation | tr -d '\r' || true)"
if [[ -z "$APP_PID" ]]; then
  echo "::error::Application process exited after launch."
  exit 1
fi

adb exec-out screencap -p > "$EVIDENCE/android-app-screen.png"
test -s "$EVIDENCE/android-app-screen.png"
adb shell dumpsys activity activities > "$EVIDENCE/activities.txt"
grep -F "com.shuttlecar.automation/.MainActivity" "$EVIDENCE/activities.txt"
adb logcat -d -t 5000 > "$EVIDENCE/device-logcat.txt"
if grep -E "FATAL EXCEPTION|Process: com\\.shuttlecar\\.automation" "$EVIDENCE/device-logcat.txt"; then
  echo "::error::Android application crash detected in logcat."
  exit 1
fi

echo "Android emulator install, launch, foreground-process, screenshot, and crash-log checks passed."
