#!/usr/bin/env sh
# macOS / Linux launcher
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  rnd() { python3 -c "import secrets,string;a=string.ascii_letters+string.digits
while True:
    s=''.join(secrets.choice(a) for _ in range($1))
    if any(c.isalpha() for c in s) and any(c.isdigit() for c in s): print(s); break"; }
  ADMIN=$(rnd 16); DEMO=$(rnd 16)
  cat > .env <<EOT
POSTGRES_PASSWORD=$(rnd 28)
MONGO_PASSWORD=$(rnd 28)
SECRET_KEY=$(rnd 64)
ADMIN_EMAIL=admin@example.com
ADMIN_NAME=Administrator
ADMIN_PASSWORD=$ADMIN
SEED_DEMO_DATA=true
DEMO_PASSWORD=$DEMO
PUBLIC_URL=http://localhost:5173
WEB_PORT=5173
COOKIE_SECURE=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOT
  echo "Admin: admin@example.com / $ADMIN"
  echo "Demo coach: coach@demo.example.com / $DEMO   (members: aarav@, meera@, rohan@ demo.example.com)"
fi
docker compose up --build -d
echo "Open http://localhost:5173"
