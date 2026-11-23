# Plan 041 impact analysis

## Task 6 · Widget exception diagnostics (LF-21)

Ordinary widget exceptions use a fixed diagnostic by default. The host result and
its `render-failed` event both omit thrown text. The tests
`thrown_widget_text_never_reaches_a_host_event`,
`render_placement_drops_unrequested_runner_debug` and
`quickjs_thrown_text_is_not_returned` cover the host and runner boundaries.
`worker_debug_returns_bounded_thrown_text_only_when_asked`,
`preview_returns_thrown_text_in_debug` and
`render_scenarios_returns_tree_or_errors` cover author diagnostics and their bound.

### Remaining error channels for Plan 042 (LF-65)

- Structured worker and QuickJS failures still cross the boundary. The worker
  checks the shape and the QuickJS runner bounds each text field. This does not
  establish the provenance of the message, pointer, expected text or node ID.
- The host preserves typed errors from custom runners and existing
  `LiveframeFailure` passthroughs. Removing `debug` does not sanitize their other
  fields. Node IDs and pointers can also contain author-chosen keys even when
  validation itself generated the diagnostic.
- Authoring and preview deliberately request `debug` for scenario renders. An
  authoring page or tool can receive render values through that field. Host
  diagnostics expose it only when the caller opts in.
- Host-provided capture diagnostics are tracked independently in Task 10 (LF-27).
