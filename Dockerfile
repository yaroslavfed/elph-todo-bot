# syntax=docker/dockerfile:1.7
FROM nexus.eltex.loc/node:24.15.0 AS build

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .npmrc .yarnrc ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM nexus.eltex.loc/node:24.15.0-slim AS runtime

ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/EltexRootCA.crt
WORKDIR /app

COPY certificates/EltexRootCA.crt /usr/local/share/ca-certificates/EltexRootCA.crt

RUN corepack enable

COPY package.json yarn.lock .npmrc .yarnrc ./
RUN yarn install --frozen-lockfile --production

COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir /app/data /app/storage && chown node:node /app/data /app/storage

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
