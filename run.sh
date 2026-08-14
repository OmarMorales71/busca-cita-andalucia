#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec caffeinate -dimsu npm start
