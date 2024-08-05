FROM node:20-alpine AS base

ARG PORT=5000
WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm ci --prefer-offline --no-audit --no-fund

#FROM node:16-alpine
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /usr/src/app

COPY --from=base /usr/src/app/dist .
COPY --from=base /usr/src/app/node_modules .

#ENTRYPOINT [ "/sbin/tini","--", "node", "src/index.js" ]
CMD [ "src/index.js" ]
