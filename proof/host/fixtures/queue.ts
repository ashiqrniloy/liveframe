// Synthetic subset of the source queue's work-page items; Tasks 7–8 extend it.
export const queueFixture = {
  items: Array.from({ length: 50 }, (_, i) => ({
    id: `task:${i}`,
    title: `Synthetic task ${i}`,
    status: "open",
    reasonCode: "assigned",
  })),
};
