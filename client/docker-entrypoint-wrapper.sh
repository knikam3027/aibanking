#!/bin/sh
# If SSL certs don't exist yet, fall back to HTTP-only config
if [ ! -f /etc/letsencrypt/live/cbamoon.com/fullchain.pem ]; then
  echo "SSL certificates not found — starting in HTTP-only mode"
  cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name cbamoon.com www.cbamoon.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 valid=30s ipv6=off;

    location /api/ {
        set \$backend http://server:5000;
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
fi

exec nginx -g 'daemon off;'
