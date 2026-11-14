#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
build_capture() {
  swiftc -parse-as-library -O -target "$(uname -m)-apple-macosx14.0" \
    packages/macos/Bridge.swift packages/macos/Stream.swift -o "$1"
}
if [ "${1:-}" = "--capture-only" ]; then
  mkdir -p .data
  staging=$(mktemp -d .data/capture-build.XXXXXX)
  trap 'rm -rf "$staging"' EXIT
  build_capture "$staging/SkyrailCapture"
  mv "$staging/SkyrailCapture" .data/SkyrailCapture
  exit
fi
mkdir -p .data
staging=$(mktemp -d .data/mac-build.XXXXXX)
trap 'rm -rf "$staging"' EXIT
bundle="$staging/Skyrail Mac.app"
mkdir -p "$bundle/Contents/MacOS"
sh scripts/build-session-status.sh
sh scripts/build-desktop-credentials.sh
build_capture "$bundle/Contents/MacOS/SkyrailMac"
cat > "$bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>local.skyrail.mac</string><key>CFBundleName</key><string>Skyrail Mac</string><key>CFBundleExecutable</key><string>SkyrailMac</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/><key>NSAppleEventsUsageDescription</key><string>Skyrail connects to the installed official Codex Computer Use service to carry out the app actions you authorize.</string></dict></plist>
PLIST
codesign --force --sign "${SKYRAIL_CODESIGN_IDENTITY:--}" "$bundle"
codesign --verify --strict "$bundle"
if [ "${1:-}" = "--stage" ]; then
  trap - EXIT
  printf '%s\n' "$bundle"
  exit
fi
# Keep the running executable intact; install only a verified complete bundle.
if [ -d '.data/Skyrail Mac.app' ]; then
  backup=$(mktemp -d .data/mac-backup.XXXXXX)
  mv '.data/Skyrail Mac.app' "$backup/Skyrail Mac.app"
fi
mv "$bundle" '.data/Skyrail Mac.app'
if [ -f .data/SkyrailCapture ]; then
  cp '.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac' "$staging/SkyrailCapture"
  mv "$staging/SkyrailCapture" .data/SkyrailCapture
fi
