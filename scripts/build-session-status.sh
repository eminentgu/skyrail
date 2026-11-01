#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .data
swiftc -parse-as-library -O -target "$(uname -m)-apple-macosx14.0" packages/macos/SessionStatus.swift -o .data/SkyrailSessionStatus
