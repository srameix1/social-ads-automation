FROM node:18-alpine AS builder

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
FROM node:18-alpine AS runner

RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

COPY package*.json ./

# Install only production deps (native modules recompile here)
RUN npm ci --only=production

# Copy compiled output and static folders
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/database ./database

EXPOSE 4000

CMD ["npm", "start"]
