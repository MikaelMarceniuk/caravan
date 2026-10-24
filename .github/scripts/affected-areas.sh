#!/usr/bin/env bash
# Decides which CI areas run (docs/planners/m1-foundation/1.monorepo.md, decision 12,
# docs/planners/m1-foundation/2.docker-compose.md, decision P6, and 3.api-and-database.md, Q11).
# Writes one `<area>=true|false` line per area to $GITHUB_OUTPUT, or to stdout when run locally.
set -euo pipefail

# Area name → path of its workspaces (a workspace path is that path or below it).
# `web` and `mobile` join when their apps exist.
declare -A areas=([packages]=packages [api]=apps/api)
# Workspace area → path regex of files outside the workspace that its tests also depend on.
# The API tests run against the compose Postgres (docs/planners/m1-foundation/3.api-and-database.md, Q11).
declare -A area_extra_paths=([api]='^infra/')
# Area name → path regex, for areas that are not workspaces.
declare -A path_areas=([infra]='^infra/')

out="${GITHUB_OUTPUT:-/dev/stdout}"
run_all=false
affected=''
changed=''

if [[ "${GITHUB_EVENT_NAME:-}" != pull_request ]]; then
	# A push to master runs everything: it is what goes to production.
	run_all=true
else
	base="origin/${GITHUB_BASE_REF:?}"
	changed=$(git diff --name-only "$base...HEAD")
	# Root configuration and the CI itself affect every area.
	if grep -qE '^(\.github/(workflows|scripts)/|package\.json$|bun\.lock$|bunfig\.toml$|turbo\.json$|tsconfig\.base\.json$|biome\.json$|mise\.toml$)' <<<"$changed"; then
		run_all=true
	else
		# Turbo includes the dependents of every changed workspace.
		affected=$(TURBO_SCM_BASE="$base" bunx turbo ls --affected --output=json | jq -r '.packages.items[].path')
	fi
fi

for area in "${!areas[@]}"; do
	extra=${area_extra_paths[$area]:-}
	if [[ $run_all == true ]] || grep -qE "^${areas[$area]}(/|$)" <<<"$affected" ||
		{ [[ -n $extra ]] && grep -qE "$extra" <<<"$changed"; }; then
		echo "$area=true" >>"$out"
	else
		echo "$area=false" >>"$out"
	fi
done

for area in "${!path_areas[@]}"; do
	if [[ $run_all == true ]] || grep -qE "${path_areas[$area]}" <<<"$changed"; then
		echo "$area=true" >>"$out"
	else
		echo "$area=false" >>"$out"
	fi
done
