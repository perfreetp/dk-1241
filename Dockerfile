FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

COPY package*.json ./

RUN npm install -g typescript ts-node

RUN npm install

COPY . .

RUN tsc --noEmit || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
