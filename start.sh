#!/bin/bash
python manage.py migrate
python manage.py collectstatic --noinput
daphne -b 0.0.0.0 -p ${PORT:-8000} image_analyzer.asgi:application