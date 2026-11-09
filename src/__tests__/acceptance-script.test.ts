import { expect, test } from "bun:test";
import { generate, isNotApplicable, listBullets } from "../../scripts/release/acceptance.ts";

const fixture = `# Plan

## Expected Outcome

- First outcome.
- Second outcome
  continues here.

## Tasks

- [x] Task 1: One
  - Acceptance Criteria:
    - Functional:
      - Does a.
      - Does b,
        over two lines.
    - Performance: n/a — docs.
    - Code Quality: one script.
    - Security: the laws hold.
  - Approach:
    - Skills to Use: none.

- [ ] Task 2a: Two
  - Acceptance Criteria:
    - Functional: a single bullet.
    - Compatibility: adds no surface.
  - Test Cases to Write:
    - not a bullet.

## Verification (whole plan)

- not a bullet either
`;

test("acceptance_script_lists_every_bullet", () => {
  const rows = listBullets(fixture, "999");
  const text = (i: number) => rows[i]?.text ?? "";
  expect(rows.map((r) => r.id)).toEqual([
    "999.EO.1",
    "999.EO.2",
    "999.T1.F1",
    "999.T1.F2",
    "999.T1.P1",
    "999.T1.Q1",
    "999.T1.S1",
    "999.T2a.F1",
    "999.T2a.C1",
  ]);
  expect(text(1)).toBe("Second outcome continues here.");
  expect(text(3)).toBe("Does b, over two lines.");
  expect(text(7)).toBe("a single bullet.");
  expect(rows[7]?.taskTitle).toBe("Two");
  expect(isNotApplicable(text(4))).toBe(true);
  expect(isNotApplicable(text(5))).toBe(false);
});

test("acceptance_map_covers_every_bullet_of_plans_026_to_031", () => {
  // Joins the real plan files to the real mapping file without running any proof.
  const { counts, problems } = generate({
    plans: "026-031",
    map: "plans/evidence/032-acceptance-map.json",
    plansDir: "plans",
    benchRecord: "plans/evidence/032-bench.md",
    skipRuns: true,
  });
  expect(problems).toEqual([]);
  expect(counts.unmapped).toBe(0);
  expect(counts.fail).toBe(0);
});
