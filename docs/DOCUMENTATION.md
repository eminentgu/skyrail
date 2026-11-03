**[Skyrail](../README.md) / [Documentation](README.md)**

# Publishing the documentation

[简体中文](DOCUMENTATION.zh-CN.md)

Skyrail's public documentation is generated from repository Markdown and an explicit page catalog. The static website adds a product homepage, bilingual navigation, local search, a table of contents, theme switching and image inspection. Product runtime data is not part of the build.

## Preview locally

```sh
npm ci
npm run docs:build
npm run docs:preview
```

Open the printed loopback URL (normally `http://127.0.0.1:4319/skyrail/`). The preview uses the same `/skyrail/` base path as the GitHub project site. To build for another site root, set `SITE_URL` to its complete canonical URL including the trailing path.

## One source, two reading surfaces

Edit user-facing content in the paired English/Chinese Markdown files. `website/catalog.mjs` defines the published pages, titles and navigation groups. `website/copy.mjs` contains homepage and interface translations. `website/site.css` and `website/site.js` provide the static reading experience.

The builder rewrites Markdown links into website routes and keeps non-document source links on GitHub. Technical records without a translation are explicitly labeled as original-language content. All historical text remains available. The generated directory is `docs-dist/` and is ignored by Git.

## Images

Keep public assets in `docs/assets/`. Use real empty-workspace captures or synthetic fixtures; never capture private chats or personal desktop content. Label fixture screenshots as example data. Provide useful alt text, keep both language editions aligned, and retain SVG titles/descriptions.

The diagrams explain setup, permissions, remote access, control handover and phone gestures. They are product illustrations, not proof of successful system actions. See [asset notes](assets/README.md).

## GitHub Pages

Use repository **Settings → Pages → Source → GitHub Actions**. The Pages workflow builds and checks the documentation on PRs. Only a push to `main`, or an explicit manual run from `main`, can deploy using the `github-pages` environment.

The artifact includes only the static output. Publishing uses GitHub's Pages artifact and deployment actions, with deployment permissions limited to that job. Existing required main checks remain in force; CI also builds and validates the docs.

Do not select **Deploy from a branch → main / (root)**: the repository root `index.html` is a Vite development entry, so publishing it directly causes `/apps/client/src/main.tsx` to return 404. After switching Source, select `main` under **Actions → Documentation → Run workflow** to redeploy.

Configure custom domains in Pages settings. The workflow reads the actual Pages URL before building asset paths, canonical links and the sitemap, supporting both project subpaths and custom-domain roots.

## Verify before publishing

```sh
npm run docs:check
npm test
npm run build
```

The documentation check builds into a temporary directory and verifies generated internal routes/assets, English/Chinese pairs, search data, metadata and the exclusion of local runtime data. Browser QA should cover both themes, phone width, language switching, search, code copy, navigation and image expansion.

The website includes canonical/alternate URLs, Open Graph metadata, sitemap, robots and `llms.txt`. These provide discovery context; they do not guarantee search or AI indexing.
