# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM nginxinc/nginx-unprivileged:alpine
USER root
RUN apk add --no-cache nodejs
WORKDIR /app
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/dist-scanner/scanner.mjs /app/scanner.mjs
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/data && chown -R 101:101 /app
USER 101
# Scanner progress (seeds.json) lives here so --resume survives redeploys
VOLUME /app/data
EXPOSE 9876
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
