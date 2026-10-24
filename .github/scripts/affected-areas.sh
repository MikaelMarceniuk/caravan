#!/usr/bin/env bash
# Decides which CI areas run (docs/planners/m1-foundation/1.monorepo.md, decision 12).
# Writes one `<area>=true|false` line per area to $GITHUB_OUTPUT, or to stdout when run locally.
set -euo pipefail

# Area name → path prefix of its workspaces. `api`, `web` and `mobile` join when their apps exist.
declare -A areas=([packages]=packages/)

out="${GITHUB_OUTPUT:-/dev/stdout}"
run_all=false
affected=''

if [[ "${GITHUB_EVENT_NAME:-}" != pull_request ]]; then
	# A push to master runs everything: it is what goes to production.
	run_all=true
else
	base="origin/${GITHUB_BASE_REF:?}"
	# Root configuration and the CI itself affect every area.
	if git diff --name-only "$base...HEAD" |
		grep -qE '^(\.github/(workflows|scripts)/|package\.json$|bun\.lock$|bunfig\.toml$|turbo\.json$|tsconfig\.base\.json$|biome\.json$|mise\.toml$)'; then
		run_all=true
	else
		# Turbo includes the dependents of every changed workspace.
		affected=$(TURBO_SCM_BASE="$base" bunx turbo ls --affected --output=json | jq -r '.packages.items[].path')
	fi
fi

for area in "${!areas[@]}"; do
	if [[ $run_all == true ]] || grep -q "^${areas[$area]}" <<<"$affected"; then
		echo "$area=true" >>"$out"
	else
		echo "$area=false" >>"$out"
	fi
done
