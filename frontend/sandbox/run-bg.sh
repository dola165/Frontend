#!/bin/bash
# Run the sandbox server + a screenshot pass detached from the tool's process group.
# Usage: sandbox/run-bg.sh <label> [shots args...]; progress in sandbox/.runtime/<label>.log
cd "$(dirname "$0")"
mkdir -p .runtime
label=$1; shift
if ! curl -s -o /dev/null localhost:4300/api/users/me; then setsid nohup node server.mjs 4300 > .runtime/server-4300.log 2>&1 < /dev/null & sleep 1.5; fi
setsid nohup node shots.mjs "$label" "$@" > ".runtime/$label.log" 2>&1 < /dev/null &
echo "started $label"
