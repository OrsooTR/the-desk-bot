# ── build ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first: this layer is cached until package.json changes.
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop devDependencies from the tree we are about to copy out.
RUN npm prune --omit=dev

# ── runtime ──────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# state.json lives here. Mount a volume on this path, or the bot forgets
# which channels it created every time the container is replaced.
#
# No VOLUME instruction: Railway rejects the image outright if it finds one
# ("docker VOLUME is not supported, use Railway Volumes"), and other platforms
# declare mounts in their own config too. The directory is all the image needs
# to provide; where it is mounted from is the host's business.
RUN mkdir -p /app/data && chown -R node:node /app/data

# Never run as root.
USER node

# Only needed on platforms that require a bound port; harmless otherwise.
EXPOSE 8080

CMD ["node", "dist/index.js"]
