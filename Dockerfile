FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/

RUN npm ci
RUN npm --prefix web ci

COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./
COPY web ./web

RUN npm run build


FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV SQLITE_DB_PATH=/data/calories.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/openapi.yaml ./openapi.yaml

EXPOSE 8000

CMD ["node", "dist/server.js"]
