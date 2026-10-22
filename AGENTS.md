# Agent Guidelines

- Write simple, elegant code: clarity over cleverness, and the fewest moving parts that do the job.
- Always use timeouts when running shell commands.
- Bun is the only runtime and tool runner: install, build, test and scripts all use Bun. Never add a Node-only tool.

## Start here

- **`karpathy-guidelines`**: load it for all writing, reviewing and refactoring. Make surgical changes, avoid overcomplication, surface assumptions, and define verifiable success criteria.
- **`liveframe-execution`**: read it first for ANY Liveframe build, change, review or plan-task execution. It holds the rules that always apply (the four laws, primitives only, a host-API-free core, the problem class first) and routes you to the one reference the task needs.
- **Authority order.** [`docs/spec.md`](docs/spec.md) is the normative design. Accepted `decision-logs/` come next. Execution state (current phase, plan ledger, next free plan number) lives only in [`roadmap.md`](roadmap.md) §3.

## Skill routing

| Work | Skill to read first |
|------|---------------------|
| Any Liveframe code, change, review, or plan-task execution | `liveframe-execution` |
| Implementation plan, roadmap phase plan, task breakdown | `create-plan` |
| Finalizing a project, architecture, dependency or naming decision | `create-decision-log` |
| Library / framework / SDK / CLI docs, or API / config / version questions | `find-docs` (prefer it over training data and web search) |
| Non-trivial TypeScript type design (catalog-derived props, the JSX namespace) | `typescript-advanced-types` |
| Creating or extending a skill | `skill-creator` |

## Testing

- `bun run check` must pass at the end of every plan task: typecheck, lint, format check and tests.
- Evidence images (screenshots, parity captures) are local-only under `/evidence/` and never committed. A record that names an image also names the script that regenerates it.

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `bunx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `bunx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `bunx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
<!-- context7 -->

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
