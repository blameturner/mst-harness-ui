# JeffGPT — MST AG Frontend + Gateway

Personal project. Gateway + frontend for the MST AG harness.

This is incredibly Claude Coded and I make no apologies because I was lazy.

I will be tinkering with it and improving it myself later until AGI comes in 2055

## Server compose

Append this to the existing server `docker-compose.yml`. Assumes `mst-ag-01-network` is already defined.

Both images read all config from runtime environment variables — nothing is baked in at build time. You can pull the same image in dev, staging, and prod and just point it at a different gateway.

```yaml
services:
  mst-ag-gateway:
    image: ghcr.io/blameturner/mst-ag-gateway:latest
    container_name: mst-ag-gateway
    environment:
      - PORT=3900
      - HARNESS_URL=http://mst-ag-harness:3800
      - NOCODB_URL=http://nocodb:8080
      - NOCODB_TOKEN=your_token
      - NOCODB_BASE_ID=your_base_id
      - BETTER_AUTH_SECRET=your_secret
      # BETTER_AUTH_URL and FRONTEND_ORIGIN must be the browser-reachable URLs,
      # not container-internal ones — Better Auth uses them for cookies and CORS.
      - BETTER_AUTH_URL=http://100.96.243.61:3900
      - FRONTEND_ORIGIN=http://100.96.243.61:3000
      - DATABASE_URL=file:/data/auth.db
      - ALLOW_REGISTRATION=true
      - ENVIRONMENT=production
    volumes:
      - ./data/auth:/data
    ports:
      - "3900:3900"
    restart: unless-stopped
    networks:
      - mst-ag-01-network

  mst-ag-frontend:
    image: ghcr.io/blameturner/mst-ag-frontend:latest
    container_name: mst-ag-frontend
    environment:
      # Read at container start by /docker-entrypoint.d/40-write-config.sh, which
      # writes /usr/share/nginx/html/config.js. The SPA loads that file before the
      # main bundle and reads window.__ENV__.GATEWAY_URL. Change this env var and
      # restart the container — no rebuild needed.
      - GATEWAY_URL=http://100.96.243.61:3900
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - mst-ag-01-network

networks:
  mst-ag-01-network:
    external: true
```

## Build images

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/blameturner/mst-ag-gateway:latest ./gateway --push

docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/blameturner/mst-ag-frontend:latest ./frontend --push
```

No `--build-arg` is needed for the frontend — the gateway URL is injected at container start, not at build time.

