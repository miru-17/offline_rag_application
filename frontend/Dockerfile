# Build the React app, then serve it with Caddy (HTTPS + reverse proxy to the API).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# The browser talks to the API through the same address under /api.
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM caddy:2.10-alpine
COPY --from=build /src/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
