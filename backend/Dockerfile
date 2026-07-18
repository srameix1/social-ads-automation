FROM node:22-alpine AS builder

# Build tools needed for native modules (bcrypt, sharp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install ALL deps (including devDependencies for tsc)
RUN npm ci

COPY . .

# Compile TypeScript
RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS runner

RUN apk add --no-cache ffmpeg python3 make g++

# Higgsfield CLI (Kling 3.0 reel generation) — invoked via child_process.spawn('higgsfield', ...)
# in contentGeneration.service.ts. Runs as root here (no USER directive), so it reads
# credentials from /root/.higgsfield — bind-mount that path from the VPS host in EasyPanel.
RUN npm install -g @higgsfield/cli

WORKDIR /app

COPY package*.json ./

# Install only production deps (native modules recompile here)
RUN npm ci --only=production

# Copy compiled output and static folders
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/database ./database

EXPOSE 4000

CMD ["npm", "start"]
