import logging
from flask import Flask, request
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
from datetime import datetime

mongo = PyMongo()

# for loading the .env file manually
env_file = os.getenv("ENV_FILE", ".env")
load_dotenv(env_file)

def create_app():
    app = Flask(__name__)
    app.config["MONGO_URI"] = os.getenv("MONGO_URI","mongodb://localhost:27017/XORdb")

    mongo.init_app(app)
    # for the logging all requests sent to server
    log_file_path = os.getenv("LOG_FILE", "server.log")
    logging.basicConfig(
        filename = log_file_path,
        level=logging.INFO,
        format="%(asctime)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    @app.before_request
    def log_request_info():
        ip = request.remote_addr
        method = request.method
        path = request.path
        log_msg = f"{ip} {method} {path}"
        app.logger.info(log_msg)
    
    from .routes import main
    app.register_blueprint(main)

    return app