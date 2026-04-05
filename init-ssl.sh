#!/bin/bash
# Run this script ONCE on the server to obtain initial SSL certificates.
# After certs are obtained, just use: docker compose up -d

set -e

DOMAIN="cbamoon.com"
EMAIL="knikam3027@gmail.com"  # Change to your email

echo "=== Step 1: Starting with temporary HTTP-only nginx ==="

# Create a temporary nginx config (HTTP only, for ACME challenge)
docker compose down || true

# Create temp config
cat > /tmp/nginx-temp.conf << 'NGINX'
server {
    listen 80;
    server_name cbamoon.com www.cbamoon.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
NGINX

# Start only the client container with temp config
docker compose up -d client
docker cp /tmp/nginx-temp.conf banking-client:/etc/nginx/conf.d/default.conf
docker exec banking-client nginx -s reload

echo "=== Step 2: Requesting certificates from Let's Encrypt ==="

docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo "=== Step 3: Restarting with full SSL config ==="

docker compose down
docker compose up -d

echo ""
echo "=== Done! HTTPS should now work at https://$DOMAIN ==="
echo "Certbot will auto-renew certificates via the certbot container."
