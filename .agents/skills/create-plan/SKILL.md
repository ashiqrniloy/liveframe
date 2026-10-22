---
name: create-plan
description: Create and maintain numbered phase and implementation plans in `plans/` for the Liveframe repo. Every task carries acceptance criteria, an evidence-based approach, tests written first, and the repo's chores built in (spec sync, docs, conformance, public surface, backlog handoff), so executing the plan leaves no debt. Use whenever asked to create, write, update, or maintain a plan, roadmap phase plan, task breakdown, or plan document. Executing plan tasks is the liveframe-execution skill.
---

# Create Plan

A plan turns one roadmap phase, or one self-contained change, into checkable tasks. A plan is good when an executor who follows it literally leaves no debt: every new surface has a test and docs, every spec change is written back, and the tree is green after every task.

Project rules live in [references/liveframe.md](references/liveframe.md) and are mandatory. Read it before writing or amending any plan.

## Workflow

1. **Read the source.** Read the `roadmap.md` phase you are planning (Goal, Why, Scope, Done), the `docs/spec.md` sections it implements, and any decision log it depends on. The plan implements the roadmap and the spec; it does not redesign them. If code reality or a finding conflicts with the spec, record the conflict as a finding and stop. Do not improvise around it.
2. **Read the project reference**, [references/liveframe.md](references/liveframe.md): plan numbering, the task probes, chore checklists by change type, and the impact areas.
3. **Survey the code with graft** before writing approaches: `graft ask "<scope bullet>" --source`, and `graft callers <symbol> --depth all` for anything a task renames, moves or deletes. Cite `file:line`. Use `find-docs` for every third-party library, framework or CLI, and record the version and the exact APIs.
4. **Name the file.** Take the next free number from `roadmap.md` §3 and name the file `NNN-Phase-N-<Title-Slug>.md`. Split an oversized phase into `NNN-Phase-N-Part-A-<Title>.md` / `Part-B` with an explicit dependency line. Never reuse or renumber.
5. **Run the planning-time impact pass** over the impact areas in the reference. It is your reasoning, not plan content; its only output is the tasks and criteria it adds.
6. **Draft the tasks.** Run every task through the probes in the reference. Each probe answer becomes an acceptance criterion, a listed file, a test, or `n/a — <reason>`. Order tasks so each leaves the tree green.
7. **Index the plan.** Add a row to `plans/README.md`, add a `planned` row to `roadmap.md` §3, and bump the next free plan number there.
8. **Run the self-check** below before presenting the plan.

## Required plan structure

```markdown
# <Plan Title>

## Objectives
- <Objective>

## Expected Outcome
- <Observable deliverable or system state after completion>

<One paragraph: which roadmap phase and spec sections this implements, what does not ship, and anything unusual about this plan.>

## Tasks

- [ ] Task N: <title>
  - Acceptance Criteria:
    - Functional: <behavior, including rejection cases>
    - Performance: <budget or explicit non-regression>
    - Code Quality: <placement, typing, no speculative abstraction>
    - Security: <which of the four laws this touches and what fails closed>
  - Approach:
    - Skills to Use:
      - <skill — why>
    - Library Documentation to Check Before Implementation:
      - <library, version, section; or "none" plus the local docs/code to read>
    - Documentation Reviewed:
      - <spec sections, decision logs, code at file:line, external docs with versions>
    - Options Considered:
      - <option — why rejected>
    - Chosen Approach:
      - <why this fits>
    - API Notes and Examples:
      ```ts
      <minimal API shape or command>
      ```
    - Files to Create/Edit:
      - `<path>`: <change>   (complete list; mark tentative entries and say why)
  - Test Cases to Write:
    - <test name>: <what it proves; which break makes it fail>
  - Notes (executed <date>):   ← written by the executor, not while drafting

- [ ] Task N+1: Analyze architectural impact and dispose of every finding
  <Always last. See "Final task" below.>

## Verification (whole plan)
- <runnable commands, in order>

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
```

## Task writing rules

- Every task is independently checkable and has all four criteria categories.
- The approach is evidence-based. An option without a rejection reason is not an option.
- Write test cases before implementation, derive them from the criteria, and say which break makes each one fail.
- **Every task leaves `bun run check` green.** A rename updates all of its callers in the same task. Never write "red until Task N".
- **A task that changes the spec's meaning updates `docs/spec.md` in the same task**, and names the decision log if the change is a decision.
- **Scope discipline.** Implement the phase. Anything beyond it goes to Further Actions.
- Do not fill Compromises Made or Further Actions while drafting unless a constraint is already known.

## Final task: impact analysis

The last task of every plan is `Analyze architectural impact and dispose of every finding`. After every other task:

1. Sweep every impact area in the reference against the work actually delivered. Record each one, or `None — <specific reason>`, in `plans/evidence/NNN-impact-analysis.md`.
2. List every finding: work an area demands that the plan has not done.
3. Present the findings to the user in one table, with a recommended disposition (`execute` or `backlog`) for each, and record the answer.
4. `execute`: add the work as a new task above this one and execute it. `backlog`: add it to `plans/backlog.md` and list it under Further Actions.

## Self-check before presenting

- [ ] Every task answers the reference's probes, or says `n/a — <reason>`.
- [ ] No task leaves the tree red.
- [ ] Every spec-changing task updates `docs/spec.md` in the same task.
- [ ] The impact-analysis task is last.
- [ ] `## Verification (whole plan)` lists runnable commands.
- [ ] The plan is indexed in `plans/README.md` and `roadmap.md` §3.

## Execution updates

- Tick a checkbox only after its implementation and checks pass. If the approach changes, update the task's Approach, Files and Tests before continuing.
- **Commit each completed task before starting the next.** Subject: `Plan NNN T<k>: <task title>`. Stage only that task's files by path, never `git add -A`. Never bypass hooks and never push unless asked.
- At plan close, fill Compromises Made and Further Actions, then hand them off to `plans/backlog.md`:
  - Create the file only if there are items.
  - One entry per item: `## <follow-up title>`, then `- Section:`, `- Priority: P1–P4`, `- Source: plans/<file>.md`, and `- Compromise:` / `- Implications:` or `- What:` / `- Why:`.
  - Update an existing entry with the same source and title instead of duplicating it.
- Update `roadmap.md` §3 with one line per plan, and only for actual execution status.
