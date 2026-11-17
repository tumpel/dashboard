# tumpel dashboard

The web dashboard for tumpel, and `@tumpel/pages`, the design tokens and page shell that the dashboard and the control plane's server-rendered pages share.

## Packages

- `packages/dashboard` (`@tumpel/dashboard`): a React single-page app built with Vite. Its components and Storybook stories sit in `src/`.
- `packages/pages` (`@tumpel/pages`): the design tokens, the page shell, and the server-rendered pages.

The types, schemas and API client come from the `tumpel/protocol` release tarballs, pinned by URL in `packages/dashboard/package.json`.

## Development

```sh
npm install
npm run check
npm test
npm run build
npm run storybook -w @tumpel/dashboard
```

## Licence

Apache-2.0. See `LICENSE` and `NOTICE`.
