# @arnilo/liveframe-runner-quickjs

An isolated [Liveframe](https://github.com/ashiqrniloy/liveframe) runner: widget code runs in QuickJS inside a child process the runner can kill, so a host gets a real isolation boundary without building its own sandbox.

> Work in progress for 0.3.0. The runner itself lands in plan 031 Task 4; this package currently exports nothing.

Requires Bun ≥ 1.4.2 and `@arnilo/liveframe` `~0.3.0`.
