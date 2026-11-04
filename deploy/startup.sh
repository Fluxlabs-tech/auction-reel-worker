#!/usr/bin/env bash
set -euo pipefail

echo "=== Booting Auction Reel Server on GCE ==="
mkdir -p /mnt/disks/scratch /mnt/disks/themes

# Verify ffmpeg capabilities
ffmpeg -filters 2>&1 | grep -q " ass " || (echo "FATAL: libass filter missing" && exit 1)
ffmpeg -decoders 2>&1 | grep -q "libvpx-vp9" || (echo "FATAL: libvpx-vp9 decoder missing" && exit 1)

echo "ffmpeg checks passed."
exec docker compose -f deploy/compose.yml up --build -d
