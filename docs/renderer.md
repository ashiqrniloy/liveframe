# React renderer

The renderer draws validated UI trees using the host's primitive implementations. Import `createRenderer` and `implement` from `@arnilo/liveframe/react`. The host supplies the catalog, implementations, arrival validator, theme and design-system identities, intent handler and fallback.

## Server rendering and hydration

Create the renderer once, then render its `Surface` with React DOM on the server:

```tsx
const { Surface } = createRenderer({ catalog, implementations });
const props = { tree, validator, theme, designSystem, onIntent, fallback };
const html = renderToString(<Surface {...props} />);
```

In the browser, build the validator from the same catalog, capabilities and widget manifest, and hydrate with the same tree, style identities, implementations and fallback:

```tsx
hydrateRoot(container, <Surface {...props} />, {
  onRecoverableError: reportError,
});
```

The host transports tree data and the manifest; widget code stays on the backend. The server and browser both validate the tree before drawing any primitive. Invalid trees render the whole-surface fallback and hydrate normally. An intent only requests an operation: the host must re-check it before updating state or dispatching an action.

`Surface` includes a wrapper and a sibling scoped portal container in its server markup. An implementation receives `portal: undefined` during SSR and its first browser render. Portal-based overlays should return `null` until the container is supplied after mounting, then use `createPortal(children, portal)`. Both containers retain the surface's theme and design-system scope. Rendering must not branch on browser globals or otherwise change the initial markup.

## Server rendering failures

React error boundaries do not catch server rendering errors. If an implementation throws, `renderToString(<Surface … />)` throws to the host. Catch that failure at the request boundary, report it, and send fallback markup instead:

```tsx
let html;
try {
  html = renderToString(<Surface {...props} />);
} catch (error) {
  reportError(error);
  html = renderToString(fallback);
}
```

If the browser then hydrates `Surface` over this replacement markup, React recovers by rendering on the client. This exceptional path can report a recoverable hydration error; ordinary successful SSR and invalid-tree fallbacks require matching markup and produce none. A primitive that still throws in the browser is caught by its node's error boundary, which renders `fallback` while healthy sibling nodes remain interactive.

These semantics follow React's [hydration contract](https://react.dev/reference/react-dom/client/hydrateRoot) and [error-boundary limitations](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).
