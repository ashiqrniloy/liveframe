import type { ImplementationProps } from "../../react/index.ts";

/** App-owned primitive: fields stay local until a native form submit. */
export function ObjectForm(input: ImplementationProps) {
  return (
    <form
      className={input.slot("root")}
      style={input.style}
      aria-label="Commit fields"
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        input.emit("onSubmit", { reason: String(fields.get("reason") ?? ""), confirm: fields.has("confirm") });
      }}
    >
      <label>
        Reason
        <input name="reason" defaultValue="initial" />
      </label>
      <label>
        Confirm
        <input type="checkbox" name="confirm" />
      </label>
      <button type="submit">Submit fields</button>
    </form>
  );
}
