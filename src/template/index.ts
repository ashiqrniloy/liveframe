// The template widget subpath (spec §7.6): host-API-free validation and the expression language.
export type { Expr, Template, TemplateComponent, TemplateIntent, TemplateNode } from "./document.ts";
export { validateTemplate } from "./document.ts";
export { checkExpression, evaluate } from "./expr.ts";
export type { ExprType } from "./scope.ts";
