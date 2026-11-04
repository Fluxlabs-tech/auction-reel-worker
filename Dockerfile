FROM node:22-slim

# Install system dependencies: ffmpeg (with libass and libvpx-vp9 support), fontconfig, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Fail-fast validation of required ffmpeg filters and decoders
RUN ffmpeg -filters 2>&1 | grep -q " ass " || (echo "FATAL: ffmpeg missing libass 'ass' filter" && exit 1)
RUN ffmpeg -decoders 2>&1 | grep -q "libvpx-vp9" || (echo "FATAL: ffmpeg missing 'libvpx-vp9' decoder" && exit 1)

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies and build tools
RUN npm ci

# Copy application source and fonts
COPY tsconfig.json ./
COPY src/ ./src/
COPY fonts/ ./fonts/

# Install bundled fonts into system fontconfig
RUN mkdir -p /usr/share/fonts/truetype/poppins && \
    cp fonts/*.ttf /usr/share/fonts/truetype/poppins/ && \
    fc-cache -f

# Compile TypeScript
RUN npm run build && npm prune --omit=dev

# Create scratch and cache directories
RUN mkdir -p /tmp/auction-reels-scratch /tmp/reel-themes

EXPOSE 8080

CMD ["node", "dist/src/index.js"]
