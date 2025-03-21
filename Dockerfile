FROM node:22-alpine AS base

RUN apk add --no-cache tini
WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm ci --production -prefer-offline --no-audit --no-fund --ignore-scripts

COPY . .

ENTRYPOINT ["/sbin/tini", "--", "npm", "start" ]
