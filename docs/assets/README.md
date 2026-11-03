# Documentation assets

The SVG banners reuse Skyrail's repository-native rail mark. Their light/dark variants contain no scripts, external resources, embedded HTML or fonts.

`skyrail-desktop.png` and `skyrail-desktop-dark.png` are real 1280×720 captures of a fresh, empty conversation in the local application. They contain no personal conversation, account details or desktop capture. They show the current Chinese product interface; the English README labels that explicitly. These images demonstrate layout, not accepted desktop-control functionality.

When updating screenshots, use an empty local conversation, capture both themes, restore the original theme, and inspect the image for private content before committing. Update both language editions together.

## Expanded documentation gallery

`workspace-example.png`, `projects-example.png`, `permissions-example.png` and `mobile-example.png` are screenshots from the loopback-only synthetic UI fixture (`SKYRAIL_PREVIEW_CHAT=1 node tests/fixtures/desktop-preview.mjs`). They contain invented example data and simulated status. They are labeled as demonstrations, not real model/device acceptance. The mobile capture uses a 390×844 browser viewport.

The paired `*-en.svg` / `*-zh.svg` illustrations cover setup, permissions, remote routing, control handover, architecture and phone gestures. They are repository-native vector diagrams with accessible titles and descriptions. No external fonts, tracking, scripts or generated photographic assets are used.
