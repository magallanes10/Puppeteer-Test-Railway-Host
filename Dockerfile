FROM node:18  # Or your preferred Node.js version

RUN apt-get update && apt-get install -y \
    libgbm1 \
    libasound2 \
    libnss3 \
    libatk1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm-dev \
    libgtk-3-0 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libdrm2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
