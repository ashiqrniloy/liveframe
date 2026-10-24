import type { UiTree } from "@arnilo/liveframe";

// Explicit gaps in the proof scenarios; a new catalog pair must still fail coverage.
export const supplementalExample: UiTree = {
  format: "liveframe/1",
  catalogId: "proof.ui@1",
  surfaceId: "conformance/remaining",
  revision: 0,
  root: {
    id: "root",
    kind: "grid",
    props: {},
    children: [
      { id: "root/image", kind: "image", props: { src: "/conformance.png", alt: "Conformance fixture" } },
      { id: "root/link", kind: "link", props: { label: "Details", href: "#details" } },
      { id: "root/danger", kind: "button", variant: "danger", props: { label: "Delete" } },
      { id: "root/select", kind: "select", props: { label: "Choice", options: [{ value: "one", label: "One" }] } },
      { id: "root/checkbox", kind: "checkbox", props: { label: "Checked", checked: true } },
      { id: "root/switch", kind: "switch", props: { label: "Enabled", checked: false } },
      {
        id: "root/menu",
        kind: "menu",
        props: { label: "Actions" },
        children: [{ id: "root/menu/delete", kind: "menuItem", variant: "danger", props: { label: "Delete" } }],
      },
      {
        id: "root/popover",
        kind: "popover",
        props: { label: "More" },
        children: [
          { id: "root/popover/trigger", kind: "button", props: { label: "More" } },
          { id: "root/popover/content", kind: "text", props: { text: "Details" } },
        ],
      },
      {
        id: "root/dialog",
        kind: "dialog",
        props: { label: "Confirm", open: true },
        children: [{ id: "root/dialog/content", kind: "text", props: { text: "Confirm deletion" } }],
      },
      {
        id: "root/tooltip",
        kind: "tooltip",
        props: { text: "Help" },
        children: [{ id: "root/tooltip/trigger", kind: "button", props: { label: "Help" } }],
      },
    ],
  },
};
