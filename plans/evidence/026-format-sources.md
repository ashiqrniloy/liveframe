# Plan 026 Task 9: one source for structural formats

Baseline: `d3155eef346c4f8076488227c95ab39b08f963da` (Task 8).

Each complete transport definition now lives with its format. The registry points
directly at those values, and the existing publisher serializes them unchanged.
`src/validate/format-schema.ts` compiles their internal JSON Schema vocabulary into
closures, reusing `compileSchema` and its closed-object checker. It rejects unsupported
keywords and resolves recursive and external references offline. Compilation is
cached by definition and document scope, never by untrusted input identity.

The public widget language cannot express the formats' recursive references, open
maps, tuples, unions and conditional applicators. Its public types and grammar
remain unchanged; its existing structural meta-schema moved to
`src/formats/language.ts` and now also supplies its structural checker.

Install relationships retain separate owners: vocabulary references, catalog
references, schema-keyword relationships, manifest bindings and initial state,
theme completeness and contrast, design-system inheritance, theme-role authority,
alpha normalization, recipe completeness and token references, patch revision
ordering, package byte bounds and scenario-name uniqueness. Metadata budgets run
before recursive transport checks so cyclic metadata retains its bounded error.

The catalog-specific tree validator still validates and counts bytes in one walk.
Its envelope fields and scalar metadata checks read the tree definition; event
field sets read the intent definitions. No generic second tree traversal was
added to rendering or arrival validation.

Compatibility proof:

- The original focused baseline passed: 34 tests, zero failures.
- The original corpus documents, expected diagnostic vectors and all 200 seeded
  install-checker mutations per seed are retained. The first 20 mutations and each
  valid seed additionally compare the compiled structural checker directly with
  Ajv, including the vocabulary embedded in the catalog.
- `published_schemas_byte_identical_to_0_2_3_unless_registered` checks the release
  baseline digests and requires a migration-linked register entry for a difference.
  Task 9 changes no schema bytes; Task 4's already registered UI-tree change remains.
- Compiler tests cover applicators, tuples, pattern/property intersection,
  property names, object equality for uniqueness, recursive references, reference
  scope, unknown keywords and the structure/relationship boundary.
- Existing pointed diagnostics remain covered. The SDK bundle's lexical module
  scan now distinguishes `node:fs` from an ordinary `node:` object property; the
  independent source and compiled-output host-API scans remain enabled.

Documentation: `docs/formats.md`, the changelog and Task 9's approach describe the
implementation. No new dependency, public declaration, format, normative spec
meaning, version bump or publication is introduced.

The JSON Schema applicator semantics were checked through Context7 against the
[official specification source](https://github.com/json-schema-org/json-schema-spec/blob/main/specs/jsonschema-core.md):
`oneOf`, `allOf`, conditional application and the interaction of
`patternProperties` with `additionalProperties`.

Reproduce the checks:

```sh
timeout 900s bun run check
timeout 900s taskset -c 10 bun bench/ab.ts d3155eef346c4f8076488227c95ab39b08f963da bench/validator.bench.ts --runs 9
timeout 900s bun bench/ab.ts d3155eef346c4f8076488227c95ab39b08f963da bench/format-install.bench.ts --runs 9
timeout 30s git diff d3155eef346c4f8076488227c95ab39b08f963da -- schemas conformance
```

`bench/format-install.bench.ts` uses the proof catalog, capabilities, manifest,
Certified theme and design system: 30 warm-ups, then the median of 101 batches of
ten validated calls. Every call asserts successful validation. The existing A/B
driver copies the same benchmark to both worktrees and reports paired ratios.

## Performance results

The final paired comparisons use CPU 10 for both sides. Nine base/head pairs run
sequentially for each benchmark. Whole-tree validation ratios are 0.896–0.995;
patch application is 0.860, diffing 1.014, reused compilation 0.974 and first
compilation 0.559. Each of the five installation paths improves, at 0.223–0.888.
These budgeted paths pass the relative 1.02 limit.

The full table also retains the props-only reference measurements. Some exceed
1.02 (up to 1.085 for the interpreted reference, 1.037 for the compiled reference).
This is not proof of a 2% limit for every isolated reference submetric. The actual
whole-tree paths are the acceptance target; Task 10 retains the whole-plan bench
and impact review, including this reference variance. No absolute or quiet-host
budget claim is made: seven of nine base children and seven of nine head children
missed absolute validator budgets under load. All installation children exited 0.

The original approach's manifest regression was removed by compiling already
validated state schemas directly; recursive meta-schema relationships run as each
form finishes. Successful schema predicates use a zero-diagnostic probe; failures
rerun for diagnostics. Closed objects reuse the existing allocation-free success
path, and disjoint required tags select a branch without trying every form.
Overlapping tags, open branches and object-valued tags retain general union
semantics and have explicit regression tests.

Production source delta: 862 lines removed and 835 added, including the new
compiler and shared definitions: **27 net lines deleted**. Tests, the installation
benchmark and documentation are additional verification rather than production
code. No public declarations, schema bytes or conformance files changed.

Final A/B reports:


### Validator

```text
bench/validator.bench.ts: 9 paired runs, base d3155eef346c4f8076488227c95ab39b08f963da vs head (checkout)
metric                                 base median  head median  paired ratio (head/base)
agent-home.compiledMs                  1.151        1.094        0.967
agent-home.compiledUsPerNode           1.696        1.611        0.967
agent-home.genericMs                   1.168        1.109        0.987
agent-home.genericUsPerNode            1.720        1.633        0.987
agent-home.compiledPropsMs             0.05830      0.05515      1.017
core-queue.small.compiledMs            0.007778     0.006512     0.968
core-queue.small.compiledUsPerNode     1.556        1.302        0.968
core-queue.small.genericMs             0.008530     0.006614     0.823
core-queue.small.genericUsPerNode      1.706        1.323        0.823
core-queue.small.compiledPropsMs       0.0005924    0.0003524    0.910
core-queue.medium.compiledMs           0.6104       0.6278       0.948
core-queue.medium.compiledUsPerNode    1.474        1.516        0.948
core-queue.medium.genericMs            0.6216       0.6792       1.053
core-queue.medium.genericUsPerNode     1.501        1.641        1.053
core-queue.medium.compiledPropsMs      0.03658      0.02915      0.863
core-queue.large.compiledMs            0.8624       0.6892       0.896
core-queue.large.compiledUsPerNode     1.934        1.545        0.896
core-queue.large.genericMs             0.8389       0.7110       1.057
core-queue.large.genericUsPerNode      1.881        1.594        1.057
core-queue.large.compiledPropsMs       0.03743      0.03074      0.961
core-queue.full.compiledMs             0.8723       0.8842       0.903
core-queue.full.compiledUsPerNode      1.844        1.869        0.903
core-queue.full.genericMs              0.8248       0.7574       1.031
core-queue.full.genericUsPerNode       1.744        1.601        1.031
core-queue.full.compiledPropsMs        0.03257      0.03360      1.037
git-status.compiledMs                  0.1595       0.1430       0.966
git-status.compiledUsPerNode           1.100        0.9861       0.966
git-status.genericMs                   0.2027       0.2095       1.060
git-status.genericUsPerNode            1.398        1.445        1.060
git-status.compiledPropsMs             0.009930     0.01105      0.950
rack-module.compiledMs                 0.2640       0.2409       0.979
rack-module.compiledUsPerNode          1.119        1.021        0.979
rack-module.genericMs                  0.2812       0.2898       1.085
rack-module.genericUsPerNode           1.192        1.228        1.085
rack-module.compiledPropsMs            0.01729      0.01580      0.992
synthetic-queue.compiledMs             0.5227       0.4605       0.903
synthetic-queue.compiledUsPerNode      1.481        1.305        0.903
synthetic-queue.genericMs              0.5256       0.5520       0.956
synthetic-queue.genericUsPerNode       1.489        1.564        0.956
synthetic-queue.compiledPropsMs        0.03127      0.02844      1.028
mixed-feed.compiledMs                  0.04936      0.04589      0.995
applyPatch.medianMs                    0.1924       0.1400       0.860
diffTrees.medianMs                     0.6174       0.6144       1.014
compileValidator.reusedMedianMs        0.1797       0.1637       0.974
compileValidator.firstCompileMedianMs  2.031        0.7827       0.559
load average (1/5/15 min) before: 9.61 8.65 9.52; after: 8.11 14.99 12.92
```

### Installation

```text
bench/format-install.bench.ts: 9 paired runs, base d3155eef346c4f8076488227c95ab39b08f963da vs head (checkout)
metric                 base median  head median  paired ratio (head/base)
catalog.medianMs       0.5296       0.2773       0.542
capabilities.medianMs  0.03865      0.01854      0.480
manifest.medianMs      0.02377      0.02131      0.888
theme.medianMs         0.3691       0.08679      0.223
designSystem.medianMs  3.827        2.603        0.698
load average (1/5/15 min) before: 8.46 11.54 11.89; after: 7.39 10.48 11.49
```

## Final validation

`timeout 900s bun run check` passed on the final implementation: build, generated
files, API baseline, schema-byte identity, typecheck, lint, format, **1,107 passing
tests, four existing skips, zero failures** across 124 files (366.52 seconds of
tests). `git diff -- schemas conformance` is empty. Task 10 remains open.
