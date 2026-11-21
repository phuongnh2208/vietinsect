FROM node:20-bookworm-slim

# Cài Chromium và bộ font hỗ trợ đầy đủ tiếng Việt có dấu (DejaVu, Liberation, Noto)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-noto-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Chạy container bằng user không phải root (node:1000)
RUN chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server.js"]
