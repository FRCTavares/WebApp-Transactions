#!/bin/bash
# Package the exact committed source for the HomeServer's deploy-finance script.
#
#   deploy/package-release.sh [output-dir]      (default: ./release-stage)
#
# Produces <output-dir>/finance-g<sha>/{finance-source.tar,release.json}. Copy that directory to the
# server (e.g. scp -r ... homeserver:~/stage/) and run deploy-finance there. Only COMMITTED files are
# archived, and the script refuses to run with uncommitted tracked changes so what you tested is what
# you ship.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "refusing: tracked files have uncommitted changes; commit or stash first" >&2
  exit 1
fi

SHA=$(git rev-parse HEAD)
RELEASE_ID="finance-g${SHA}"
OUT="${1:-$PWD/release-stage}/${RELEASE_ID}"
mkdir -p "$OUT"
[ ! -e "$OUT/finance-source.tar" ] || { echo "refusing: $OUT already holds a release" >&2; exit 1; }

git archive --format=tar HEAD -o "$OUT/finance-source.tar"

python3 - "$OUT" "$RELEASE_ID" "$SHA" <<'PY'
import hashlib, json, sys
out, release_id, sha = sys.argv[1:4]
digest = hashlib.sha256(open(f"{out}/finance-source.tar", "rb").read()).hexdigest()
json.dump(
    {"release_id": release_id, "git_sha": sha, "source_sha256": digest},
    open(f"{out}/release.json", "w"),
    indent=2,
)
print(f"{release_id}\n  finance-source.tar sha256 {digest}")
PY
echo "staged: $OUT"
