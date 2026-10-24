#!/usr/bin/env bash
# Checks that the running Postgres and Redis match docs/project/deploy.md §3
# (docs/planners/m1-foundation/2.docker-compose.md, decision P7).
# Run after `bun run infra:up`. Exits non-zero at the first mismatch.
set -euo pipefail

dir=$(cd "$(dirname "$0")" && pwd)
compose=(docker compose -f "$dir/compose.yml" -f "$dir/compose.dev.yml")

# check <name> <expected> <command...>
check() {
	local name=$1 expected=$2 actual
	shift 2
	actual=$("$@")
	if [[ $actual == "$expected" ]]; then
		echo "ok   $name = '$actual'"
	else
		echo "FAIL $name: expected '$expected', got '$actual'" >&2
		exit 1
	fi
}

sql() {
	# Single quotes on purpose: the variables are expanded by the container's shell.
	# shellcheck disable=SC2016
	"${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' _ "$1"
}

shm_mb() {
	"${compose[@]}" exec -T postgres df -m /dev/shm | awk 'NR == 2 { print $2 }'
}

redis() {
	"${compose[@]}" exec -T redis redis-cli "$@"
}

# `CONFIG GET` prints the name, then the value.
redis_config() {
	redis config get "$1" | sed -n 2p
}

check 'postgres max_connections' 50 sql 'SHOW max_connections'
check 'postgres shared_buffers' 256MB sql 'SHOW shared_buffers'
check 'postgres effective_cache_size' 1GB sql 'SHOW effective_cache_size'
check 'postgres uuidv7() is a version 7 UUID' t sql "SELECT uuidv7()::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7'"
check 'postgres /dev/shm size (MB)' 256 shm_mb
check 'redis ping' PONG redis ping
check 'redis maxmemory (256mb)' 268435456 redis_config maxmemory
check 'redis save' '' redis_config save
check 'redis appendonly' no redis_config appendonly
