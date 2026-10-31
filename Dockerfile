# --- Build stage ---
FROM node:26.13.0-alpine3.24 AS builder

WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM nginx:1.31.8-alpine3.24

RUN apk upgrade --no-cache brotli-libs curl libcurl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/security-headers.conf

# Render the Supabase origin into the CSP. The strict pattern also keeps
# spaces, quotes and semicolons out of the generated nginx config.
ARG VITE_SUPABASE_URL
RUN set -eu; \
    origin="$(printf '%s' "${VITE_SUPABASE_URL:-}" | sed -E 's|^(https?://[^/]*).*$|\1|')"; \
    if ! printf '%s' "$origin" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'; then \
      echo "VITE_SUPABASE_URL must be set to an http(s) URL such as https://<project-ref>.example" >&2; \
      exit 1; \
    fi; \
    wss_origin="$(printf '%s' "$origin" | sed -E 's|^https?://|wss://|')"; \
    sed -i -e "s|@SUPABASE_ORIGIN@|${origin}|g" -e "s|@SUPABASE_WSS_ORIGIN@|${wss_origin}|g" /etc/nginx/security-headers.conf; \
    if grep -q '@' /etc/nginx/security-headers.conf; then \
      echo "unrendered placeholder left in security-headers.conf" >&2; \
      exit 1; \
    fi

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
