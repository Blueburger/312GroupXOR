from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app import mongo
from werkzeug.security import generate_password_hash, check_password_hash
import os, re, uuid, hashlib
main = Blueprint('main', __name__)

@main.route("/")
def index():
    username = session.get("username")
    return render_template("index.html", username=username)


@main.route("/game")
def game():
    if "username" not in session:
        return redirect(url_for("main.index"))
    return render_template("game.html", username=session["username"])

@main.route("/pingdb")
def ping_db():
    from app import mongo
    try:
        mongo.db.command("ping")
        return "MongoDB is connected!"
    except Exception as e:
        return f"DB Error: {e}"


# FOR ACCOUNT REGISTRATION
# Password policy function
def password_is_valid(password):
    return (
        len(password) >= 8 and
        re.search(r"[A-Z]", password) and
        re.search(r"[!@#$%^&*(),.?\":{}|<>]", password)
    )

# Hash a session token to store
def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


@main.route("/register", methods=["POST"])
def register():
    username = request.form.get("new_username")
    password = request.form.get("new_password")

    if not password_is_valid(password):
        return "Password must be 8+ characters, contain a capital letter and a special character.", 400

    # Check if user exists
    if mongo.db.users.find_one({"username": username}):
        return "Username already exists.", 400

    # Hash password and save
    hashed_pw = generate_password_hash(password)
    mongo.db.users.insert_one({"username": username, "password": hashed_pw})

    return redirect(url_for("main.index"))


@main.route("/login", methods=["POST"])
def login():
    username = request.form.get("username")
    password = request.form.get("password")

    user = mongo.db.users.find_one({"username": username})
    if not user or not check_password_hash(user["password"], password):
        return "Invalid credentials", 401

    # Generate a session token
    raw_token = str(uuid.uuid4())
    token_hash = hash_token(raw_token)

    # Save hashed token to DB
    mongo.db.tokens.insert_one({"username": username, "token_hash": token_hash})

    # Store info in session (cookie)
    session["username"] = username
    session["token"] = raw_token

    return redirect(url_for("main.index"))

@main.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.index"))