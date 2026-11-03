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
mkdir -p '.data/Skyrail Mac.app/Contents/MacOS'
sh scripts/build-session-status.sh
build_capture '.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac'
if [ -f .data/SkyrailCapture ]; then
  cp '.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac' .data/SkyrailCapture
fi
cat > '.data/Skyrail Mac.app/Contents/Info.plist' <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>local.skyrail.mac</string><key>CFBundleName</key><string>Skyrail Mac</string><key>CFBundleExecutable</key><string>SkyrailMac</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
codesign --force --sign - '.data/Skyrail Mac.app'
