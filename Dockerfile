FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl netcat-openbsd

COPY package.json ./
COPY tsconfig.json next.config.ts postcss.config.js tailwind.config.ts next-env.d.ts ./
COPY prisma ./prisma
COPY app ./app
COPY lib ./lib
COPY types ./types
COPY scripts ./scripts

EXPOSE 3000

CMD ["sh", "./scripts/docker-dev.sh"]
