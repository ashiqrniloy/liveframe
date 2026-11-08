/** @jsxImportSource @arnilo/liveframe/sdk */
import { Heading, Stack, Text } from "./ui.gen.ts";

/** A shared component: widgets import it as `liveframe:lib/acme.cards@<version>` instead of copying it in. */
export function TaskCard({ title, detail }: { title: string; detail: string }) {
  return (
    <Stack gap="space.1" padding="space.3" label={title}>
      <Heading key="title" text={title} level={3} />
      <Text key="detail" text={detail} />
    </Stack>
  );
}

/** A library package renders its scenarios as a gallery, so a host can preview it like any widget. */
export default function Gallery() {
  return <TaskCard title="Review the release notes" detail="From the acme.cards gallery" />;
}
