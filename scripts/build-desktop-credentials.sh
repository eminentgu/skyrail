#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .data
staging=$(mktemp -d .data/credentials-build.XXXXXX)
trap 'rm -rf "$staging"' EXIT
swiftc -O -target "$(uname -m)-apple-macosx14.0" packages/macos/DesktopCredentials.swift -o "$staging/SkyrailCredentials"
codesign --force --sign "${SKYRAIL_CODESIGN_IDENTITY:--}" "$staging/SkyrailCredentials"
mv "$staging/SkyrailCredentials" .data/SkyrailCredentials
