#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p '.data/Skyrail Mac.app/Contents/MacOS'
sh scripts/build-session-status.sh
swiftc -parse-as-library -O -target "$(uname -m)-apple-macosx14.0" packages/macos/Bridge.swift packages/macos/Stream.swift -o '.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac'
cat > '.data/Skyrail Mac.app/Contents/Info.plist' <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>local.skyrail.mac</string><key>CFBundleName</key><string>Skyrail Mac</string><key>CFBundleExecutable</key><string>SkyrailMac</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
codesign --force --sign - '.data/Skyrail Mac.app'
