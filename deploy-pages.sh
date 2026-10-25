#!/usr/bin/env bash
# Builds the site and publishes it to the gh-pages branch (GitHub Pages).
set -euo pipefail
BASE_PATH=${BASE_PATH:-/nyc-barbershop/} npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy site"
git push -f "$(cd .. && git remote get-url origin)" gh-pages
rm -rf .git
