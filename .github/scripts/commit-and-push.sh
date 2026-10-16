#!/usr/bin/env bash
# Commit generated files and push them to a branch without non-fast-forward
# rejections when the branch moved after actions/checkout.
#
#   commit-and-push.sh snapshot <branch> <message> <path>...
#     Copies <path>s from the working tree onto the latest origin/<branch>
#     (created from HEAD if it doesn't exist yet) and commits them there.
#     For generated-output branches (snapshot onto latest remote tip).
#
#   commit-and-push.sh rebase <branch> <message> <path>...
#     Commits <path>s on the current checkout, then rebases onto the latest
#     origin/<branch> before each push. Fails on a rebase conflict instead of
#     overwriting someone else's change. Needs a full-history checkout.
#
# Retries the push a few times in case the branch moves again mid-push.
set -euo pipefail

mode=${1:?mode (snapshot|rebase) required}
branch=${2:?branch required}
message=${3:?commit message required}
shift 3
[ "$#" -gt 0 ] || { echo "at least one path required" >&2; exit 2; }

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

remote_has_branch() {
  git ls-remote --exit-code --heads origin "$branch" >/dev/null
}

snapshot() {
  local saved
  saved=$(mktemp -d)
  for p in "$@"; do
    if [ -e "$p" ]; then
      mkdir -p "$saved/$(dirname "$p")"
      cp -R "$p" "$saved/$p"
    fi
  done

  local exists
  for attempt in 1 2 3; do
    if remote_has_branch; then
      exists=1
      git fetch --no-tags --depth=1 origin "+refs/heads/$branch:refs/remotes/origin/$branch"
      git checkout --force -B "$branch" "origin/$branch"
    else
      exists=0
      git checkout --force -B "$branch"
    fi

    for p in "$@"; do
      rm -rf -- "$p"
      if [ -e "$saved/$p" ]; then
        mkdir -p "$(dirname "$p")"
        cp -R "$saved/$p" "$p"
      fi
    done
    git add -A -- "$@"
    if git diff --cached --quiet; then
      echo "No changes to commit on $branch."
      [ "$exists" = 1 ] && return 0
    else
      git commit -m "$message"
    fi
    if git push origin "HEAD:refs/heads/$branch"; then
      return 0
    fi
    echo "Push to $branch rejected (attempt $attempt); refetching and retrying." >&2
    sleep $((attempt * 5))
  done
  return 1
}

rebase() {
  git add -A -- "$@"
  if git diff --cached --quiet; then
    echo "No changes to commit on $branch."
    return 0
  fi
  git commit -m "$message"

  for attempt in 1 2 3; do
    git fetch --no-tags origin "+refs/heads/$branch:refs/remotes/origin/$branch"
    if ! git rebase "origin/$branch"; then
      git rebase --abort
      echo "Rebase onto origin/$branch conflicted; resolve manually." >&2
      return 1
    fi
    if git push origin "HEAD:refs/heads/$branch"; then
      return 0
    fi
    echo "Push to $branch rejected (attempt $attempt); refetching and retrying." >&2
    sleep $((attempt * 5))
  done
  return 1
}

case "$mode" in
  snapshot) snapshot "$@" ;;
  rebase) rebase "$@" ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac
