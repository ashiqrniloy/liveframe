/** @jsxImportSource @arnilo/liveframe/sdk */
import { jsx, primitive } from "@arnilo/liveframe/sdk";
import { Card } from "./card.tsx";

export default function GateCard() {
  return <Card title="Gate">{jsx(primitive("text"), { text: "Installed archive" }, "detail")}</Card>;
}
