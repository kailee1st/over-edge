#!/bin/sh
cd "$(dirname "$0")"
while true; do
  python -m http.server 8000 >/dev/null 2>&1
  sleep 1
done
