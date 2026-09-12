# Zoreon docs site

Built with [Docusaurus](https://docusaurus.io/). Serves the live docs at https://zyvorai.github.io/zoreon/.

Points directly at the repo's existing `docs/` folder rather than a hand-curated copy. The hero image on the homepage is served in place from `../docs/assets/zoreon-readme-hero.jpg` via `staticDirectories`, not duplicated into `website/static/`.

## Local development

```bash
npm install
npm start
```

## Build

```bash
npm run build
npm run serve   # preview the production build locally
```

## Deployment

Automatic via `.github/workflows/pages.yml` on every push to `main` touching `website/`, `docs/`, or the workflow file itself. No manual `npm run deploy` step.
