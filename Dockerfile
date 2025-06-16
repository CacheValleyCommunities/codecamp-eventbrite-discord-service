FROM node:20-alpine

# Install needed build tools for better-sqlite3
RUN apk add --no-cache make gcc g++ python3

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

RUN mkdir -p /usr/src/app/data
RUN chown -R node:node /usr/src/app/data
RUN chmod -R 755 /usr/src/app/data

COPY . .

CMD ["node", "index.js"]
