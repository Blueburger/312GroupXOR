#!/bin/bash

echo "Flask + Mongo Bootstrap Script"

echo "Choose an option:"
echo "1) Run everything with Docker Compose (Flask + Mongo)"
echo "2) Run Mongo with Docker, Flask locally"
read -p "Enter option [1 or 2]: " option

if [ "$option" = "1" ]; then
    echo "Starting full stack with Docker Compose..."
    docker compose --env-file .env.docker up --build
elif [ "$option" = "2" ]; then
    echo "Starting MongoDB via Docker Compose..."
    docker compose -f docker-compose.db-only.yml up -d
    echo "Running Flask locally with .env.local..."

    if [ ! -d "venv" ]; then
        echo " X Virtual environment not found. Run: python3 -m venv venv"
        exit 1
    fi
    echo " Activating virtual environment..."
    source venv/bin/activate

    echo " Installing dependencies"
    pip install -r requirements.txt
    
    echo " Launching Flask..."
    export ENV_FILE=.env.local
    python run.py
else
    echo "Invalid option. Please run again and choose 1 or 2."
    exit 1
fi