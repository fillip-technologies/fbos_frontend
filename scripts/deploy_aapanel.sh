#!/bin/bash
# Builds the client admin on the aaPanel server and publishes it to dist/, the site root.
# Run by fbos-deploy after it has fast-forwarded this checkout to origin/main (setup:
# growth-fbos docs/DEPLOY_AAPANEL.md), or by hand from the checkout.
#
# Vite builds into dist-build/ because aaPanel keeps an undeletable .user.ini (plus
# .well-known/ and its error pages) in the site root, which `vite build` would try to clear.
set -euo pipefail

cd "$(dirname "$0")/../clientadmin"
npm ci --no-audit --no-fund --loglevel=error
npm run build -- --outDir dist-build --emptyOutDir
rsync -a --delete \
  --exclude .user.ini --exclude .well-known --exclude 404.html --exclude 502.html \
  dist-build/ dist/
echo "Client admin deployed: $(git log --oneline -1)"
