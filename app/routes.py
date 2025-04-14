from flask import Blueprint, render_template
main = Blueprint('main', __name__)

@main.route("/")
def index():
    return render_template("index.html")

@main.route("/game")
def game():
    return render_template("game.html")

@main.route("/pingdb")
def ping_db():
    from app import mongo
    try:
        mongo.db.command("ping")
        return "MongoDB is connected!"
    except Exception as e:
        return f"DB Error: {e}"