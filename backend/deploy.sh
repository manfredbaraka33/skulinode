#!/bin/bash
set -e

# git pull is now handled by the workflow before this script runs

source venv/bin/activate
pip install -r backend/requirements.txt --quiet

cd backend
python manage.py migrate --noinput
python manage.py collectstatic --noinput
cd ..

cd frontend
npm install --silent
npm run build
cd ..

sudo systemctl restart gunicorn
sudo systemctl restart nginx

echo "Deploy complete"