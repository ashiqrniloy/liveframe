import type { LiveframeError } from "../errors.ts";

export type ConformanceCase = { name: string; run(): Promise<void>; timeout?: number };

type Details = readonly string[] | readonly LiveframeError[];

export class ConformanceFailure extends Error {
  readonly details: Details;

  constructor(
    readonly rule: string,
    readonly spec: string,
    details: Details,
  ) {
    super(`${rule} (${spec})`);
    this.name = "ConformanceFailure";
    this.details = details
      .slice(0, 20)
      .map((detail) => (typeof detail === "string" ? detail.slice(0, 2000) : detail)) as Details;
  }
}

export function check(condition: unknown, rule: string, spec: string, details: Details): asserts condition {
  if (!condition) throw new ConformanceFailure(rule, spec, details);
}
