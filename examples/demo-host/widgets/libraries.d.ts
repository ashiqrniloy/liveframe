// The types a widget sees for the library it imports. The package itself is plain data in the store;
// this file only tells the type checker what `liveframe:lib/acme.cards@<version>` exports.
declare module "liveframe:lib/acme.cards@*" {
  export const TaskCard: typeof import("./cards/entry.tsx").TaskCard;
}
