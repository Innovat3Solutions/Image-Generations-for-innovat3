FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config ./config
COPY public ./public

# SQLite DB + downloaded state extracts live here — mount a volume/disk
ENV DATA_DIR=/app/data
VOLUME /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--no-warnings", "src/server.js"]
