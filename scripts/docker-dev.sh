#!/bin/sh
set -eu

until nc -z db 5432; do
  echo "Waiting for postgres..."
  sleep 1
done

npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev -- -H 0.0.0.0 -p 3000
