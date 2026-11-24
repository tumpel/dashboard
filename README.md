# tumpel dashboard

The web dashboard for tumpel, and `@tumpel/pages`, the design tokens and page shell that the dashboard and the control plane's server-rendered pages share.

## Packages

- `packages/dashboard` (`@tumpel/dashboard`): a React single-page app built with Vite. Its components and Storybook stories sit in `src/`.
- `packages/pages` (`@tumpel/pages`): the design tokens, the page shell, and the server-rendered pages.

The types, schemas and API client come from the `tumpel/protocol` release tarballs, pinned by URL in `packages/dashboard/package.json`.

## The API origin

One build serves every stage. The dashboard reads the control plane origin at runtime from a meta tag in the page head:

```html
<meta name="tumpel-api-origin" content="https://api.example.com">
```

The built `index.html` carries no such tag. The server that hosts the dashboard must insert it into the `<head>` of every HTML response, including the single-page fallback for deep links. The content must be a bare `http` or `https` origin: scheme, host and optional port, with no path and no trailing slash. A Cloudflare Worker does it with `HTMLRewriter`:

```ts
new HTMLRewriter()
  .on("head", {
    element: (head) => head.append(`<meta name="tumpel-api-origin" content="${env.API_ORIGIN}">`, { html: true }),
  })
  .transform(response);
```

When the tag is missing or holds anything other than a bare origin, the dashboard shows what is wrong and the tag to insert instead of the app.

For `npm run dev -w @tumpel/dashboard`, set `TUMPEL_API_ORIGIN` and the dev server inserts the tag.

## `@tumpel/pages`

`npm run build -w @tumpel/pages` compiles `@tumpel/pages` to `.js` and `.d.ts` in `packages/pages/dist`. The package also exports `@tumpel/pages/tokens.css` and `@tumpel/pages/shell.css`. Inside this repo the dashboard reads the TypeScript source through the `tumpel-source` export condition.

## Releases

Successful checks on a push to main release shipped changes as one candidate. Conventional commits determine the next candidate version. The `N` in `-rc.N` counts commits since the last stable tag. The plan compares shipped files with the nearest version tag below the checked commit. It excludes Markdown, docs, the license, repository rules, GitHub configuration and package tests.

A pushed version tag releases the commit named by the tag. Both package versions must match the tag. A release publishes the dashboard and pages tarballs with their SHA-256 checksums. To build and verify the tarballs locally, run `npm run pack` and `npm run pack:check`.

The published packages contain:

- `dashboard-X.Y.Z.tgz`: `@tumpel/dashboard`, which holds only the built static assets in `dist/` and no dependencies.
- `pages-X.Y.Z.tgz`: `@tumpel/pages`, compiled to `.js` and `.d.ts`, with `tokens.css` and `shell.css`.

Pin each exactly by URL:

```json
"@tumpel/dashboard": "https://github.com/tumpel/dashboard/releases/download/v0.1.0/dashboard-0.1.0.tgz",
"@tumpel/pages": "https://github.com/tumpel/dashboard/releases/download/v0.1.0/pages-0.1.0.tgz"
```

Serve `node_modules/@tumpel/dashboard/dist` as static assets with a single-page fallback to `index.html`, and insert the API origin tag described above.

## Development

Install [convco](https://github.com/convco/convco) before running `npm test`.

```sh
npm install
npm run check
npm test
npm run build
npm run storybook -w @tumpel/dashboard
```

## Licence

Apache-2.0. See `LICENSE` and `NOTICE`.
