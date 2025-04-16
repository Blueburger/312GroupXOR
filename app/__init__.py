import logging
from flask import Flask, request, g, session
from logging.handlers import RotatingFileHandler
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
from datetime import datetime
from flask_socketio import SocketIO

socketio = SocketIO(cors_allowed_origins="*")

mongo = PyMongo()

# for loading the .env file manually
env_file = os.getenv("ENV_FILE", ".env")
load_dotenv(env_file)

def create_app():
    app = Flask(__name__)
    
    socketio.init_app(app)

    app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))  # for signing session cookies
    # Session cookie security (HttpOnly, etc.)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SECURE"] = False  # Set to True in production over HTTPS
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    app.config["MONGO_URI"] = os.getenv("MONGO_URI","mongodb://localhost:27017/XORdb")

    mongo.init_app(app)

    # for the logging all requests sent to server
    #log_file_path = os.getenv("LOG_FILE", "server.log")
    #logging.basicConfig(
    #    filename = log_file_path,
    #    level=logging.INFO,
    #    format="%(asctime)s %(message)s",
    #    datefmt="%Y-%m-%d %H:%M:%S"
    #)
    #@app.before_request
    #def log_request_info():
    #    ip = request.remote_addr
    #    method = request.method
    #    path = request.path
    #    log_msg = f"{ip} {method} {path}"
    #    app.logger.info(log_msg)
      # Setup server.log
    if not os.path.exists("logs"):
        os.mkdir("logs")

    server_handler = RotatingFileHandler("logs/server.log", maxBytes=100000, backupCount=3)
    server_handler.setLevel(logging.INFO)
    server_handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
    ))

    traffic_handler = RotatingFileHandler("logs/traffic.log", maxBytes=500000, backupCount=2)
    traffic_handler.setLevel(logging.INFO)
    traffic_handler.setFormatter(logging.Formatter("%(message)s"))

    app.logger.addHandler(server_handler)
    app.logger.setLevel(logging.INFO)

    # Store separate traffic logger
    traffic_logger = logging.getLogger("traffic_logger")
    traffic_logger.setLevel(logging.INFO)
    traffic_logger.addHandler(traffic_handler)

    app.traffic_logger = traffic_logger
    @app.before_request
    def log_request():
        if request.method in ["POST", "PUT"]:
            if request.path in ["/login", "/register"]:
                body = "[Sensitive body omitted]"
            else:
                try:
                    body = request.get_data()[:2048].decode("utf-8", errors="ignore")
                except Exception:
                    body = "[Error decoding body]"
        else:
            body = ""

        headers = {k: (v if "auth" not in k.lower() else "[REDACTED]") for k, v in request.headers.items()}

        app.traffic_logger.info(
            f"--- REQUEST ---\n"
            f"{request.method} {request.path}\n"
            f"Headers: {headers}\n"
            f"Body: {body}\n"
        )

    @app.after_request
    def log_response(response):
        try:
            if response.direct_passthrough:
                content = "[Streaming response]"
            else:
                content = response.get_data(as_text=True)[:2048]

            headers = {k: (v if "auth" not in k.lower() else "[REDACTED]") for k, v in response.headers.items()}
            app.traffic_logger.info(
                f"--- RESPONSE ---\n"
                f"Status: {response.status}\n"
                f"Headers: {headers}\n"
                f"Body: {content}\n"
            )
        except Exception:
            app.traffic_logger.info("--- RESPONSE --- [Failed to log response body]")

        # Add status code to server log
        user = session.get("username", "anon")
        app.logger.info(f"{request.remote_addr} {user} {request.method} {request.path} -> {response.status_code}")
        return response


    from .routes import main
    app.register_blueprint(main)

    return app



from . import sockets