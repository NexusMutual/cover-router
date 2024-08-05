FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm ci

#FROM node:16-alpine
FROM gcr.io/distroless/nodejs20-debian12

RUN apk add --no-cache tini

WORKDIR /usr/src/app

COPY --from=base /usr/src/app/dist .
COPY --from=build-env /usr/src/app/node_modules .

CMD [ "server.js" ]
