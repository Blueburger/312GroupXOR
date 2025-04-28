Group Project for CSE 312 Team XOR

## Running Project
Ideally this can be started via run.sh
Option 1 builds the server fully from Docker with the database
Option 2 runs the database through docker and the server locally

## If run.sh fails
If run.sh does not work for you, the server can also be started manually
1. Ensure dependencies are met by running: "pip install -r requirements.txt"
2. if running fully from docker run: "docker-compose --env-file .env.docker up --build"
3. if running only db through docker run: "docker-compose -f docker-compose.db-only.yml up -d"
    Then, to run the Flask server locally run this in the terminal:
    1. export ENV_FILE=.env.local
    2. python run.py



DEPLOYMENT
The app is deployed and accessible at: xor.cse312.dev
