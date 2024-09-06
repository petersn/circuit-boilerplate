#!/bin/sh
set -e
set -x

cd web/
npm run build
scp public/* snpbox:/var/www/peter.website/circuit-boilerplate/

