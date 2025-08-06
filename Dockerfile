# Multi-stage Docker build for LexMX
# Stage 1: Build the application
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build legal corpus and embeddings
RUN npm run build:corpus && \
    npm run build:embeddings

# Build the application
RUN npm run build

# Stage 2: Production image with nginx
FROM nginx:alpine

# Install required tools
RUN apk add --no-cache \
    curl \
    jq

# Copy nginx configuration
COPY --from=builder /app/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy legal corpus and embeddings
COPY --from=builder /app/public/legal-corpus /usr/share/nginx/html/legal-corpus
COPY --from=builder /app/public/embeddings /usr/share/nginx/html/embeddings

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Add labels
LABEL org.opencontainers.image.title="LexMX" \
      org.opencontainers.image.description="Mexican Legal AI Assistant with RAG technology" \
      org.opencontainers.image.vendor="LexMX" \
      org.opencontainers.image.url="https://github.com/artemiopadilla/lexmx" \
      org.opencontainers.image.source="https://github.com/artemiopadilla/lexmx" \
      org.opencontainers.image.documentation="https://github.com/artemiopadilla/lexmx/blob/main/README.md"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]