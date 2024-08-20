FROM node:20-alpine AS base

WORKDIR /usr/src/app
RUN apk add --no-cache tini

COPY ./package*.json ./

RUN npm ci --prefer-offline --no-audit --no-fund
COPY ./ ./

ENTRYPOINT [ "/sbin/tini","--", "node", "src/index.js" ]

#FROM node:16-alpine
#FROM base
#FROM gcr.io/distroless/nodejs20-debian12
#
#WORKDIR /usr/src/app
#
#COPY --from=base /usr/src/app/node_modules ./node_modules
#COPY ./ ./
#
#CMD [ "src/index.js" ]
