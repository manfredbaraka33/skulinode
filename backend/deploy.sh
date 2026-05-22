#!/bin/bash
set -e

cd /home/skulinode/app
git pull origin main

source venv/bin/activate
pip install -r requirements.txt --quiet

python manage.py migrate --noinput
python manage.py collectstatic --noinput

cd frontend
npm install --silent
npm run build
cd ..

sudo systemctl restart gunicorn
sudo systemctl restart nginx

echo "Deploy complete"
