# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY --from=sdk artifacts/bot-sdk.tgz artifacts/bot-sdk-nestjs.tgz /tmp/sdk/
COPY package.json ./
RUN npm pkg set "dependencies.@yaroslavfed/bot-sdk=file:/tmp/sdk/bot-sdk.tgz" "dependencies.@yaroslavfed/bot-sdk-nestjs=file:/tmp/sdk/bot-sdk-nestjs.tgz" \
  && npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=sdk artifacts/bot-sdk.tgz artifacts/bot-sdk-nestjs.tgz /tmp/sdk/
COPY package.json ./
RUN npm pkg set "dependencies.@yaroslavfed/bot-sdk=file:/tmp/sdk/bot-sdk.tgz" "dependencies.@yaroslavfed/bot-sdk-nestjs=file:/tmp/sdk/bot-sdk-nestjs.tgz" \
  && npm install --omit=dev

COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir /app/data /app/storage && chown node:node /app/data /app/storage

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
