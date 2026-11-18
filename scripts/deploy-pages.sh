#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (GitHub Pages "deploy from branch").
# Used because the CLI token on the build machine has no `workflow` scope; the
# equivalent Actions workflow lives in deploy/github-pages-workflow.yml.
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_BASE=/plottwin/ npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -qm "Deploy PlotTwin $(date -u +%Y-%m-%dT%H:%MZ)"
git push -qf "$(git -C .. remote get-url origin)" gh-pages
echo "Pushed to gh-pages"
