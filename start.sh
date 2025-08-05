#!/bin/bash
echo "Running migrations..."
python manage.py migrate --noinput
echo "Collecting static files..."
python manage.py collectstatic --noinput
echo "Starting Daphne server..."
daphne -b 0.0.0.0 -p ${PORT:-8000} image_analyzer.asgi:application