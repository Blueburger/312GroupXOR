from flask import Flask
from flask_pymongo import PyMongo
import os

mongo = PyMongo()

def create_app():
    app = Flask(__name__)
    app.config["MONGO_URI"] = os.getenv("MONGO_URI","mongodb://localhost:27017/XORdb")

    mongo.init_app(app)
    
    from .routes import main
    app.register_blueprint(main)

    return app