#!/usr/bin/env bash
# Regenerates outputs/*.txt. Run from the repository root: bash plans/evidence/031-spike/run-all.sh
set -u
cd "$(dirname "$0")/../../.."
dir=plans/evidence/031-spike
run() { name=$1; shift; echo "== $name"; timeout "${LIMIT:-150}" "$@" 2>&1 | grep -v "^Aborted" | cut -c1-400 > "$dir/outputs/$name.txt"; }
run spike bun --conditions liveframe:source $dir/spike.ts
run dispose-abort bun $dir/dispose-abort.ts
run stack-sizes bun $dir/stack-sizes.ts
run stack-recovery bun $dir/stack-recovery.ts
run jobs-abort bun $dir/jobs-abort.ts
run after-abort bun $dir/after-abort.ts
run memory bun --conditions liveframe:source $dir/memory.ts
run uninterruptible bun $dir/uninterruptible.ts
run breakdown bun --conditions liveframe:source $dir/breakdown.ts
run reuse-floor bun --conditions liveframe:source $dir/reuse-floor.ts
run reuse-floor-ng bun --conditions liveframe:source $dir/reuse-floor-ng.ts
run hold-worker bun $dir/hold-worker.ts
run process-host bun --conditions liveframe:source $dir/process-host.ts
run deno-host bun --conditions liveframe:source $dir/deno-host.ts
pkill -9 -f "[n]ode_modules/deno/deno run" || true
# uninterruptible2 holds the thread for minutes by design; record that it does not finish within the limit.
( LIMIT=20; timeout 20 bun $dir/uninterruptible2.ts default > /dev/null 2>&1; echo "uninterruptible2 default: exit $? after 20 s limit (124 = timed out, the single indexOf call never returned)" ) > $dir/outputs/uninterruptible2.txt
