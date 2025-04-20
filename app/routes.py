from flask import Blueprint, render_template, request, redirect, url_for, flash, session, current_app
from app import mongo
from werkzeug.security import generate_password_hash, check_password_hash
import os, re, uuid, hashlib
#import tkinter as tk

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

@main.route("/leaderboard")
def leaderboard():
    users_list = mongo.db.users.find({}, {"_id": 0, "username": 1, "wins": 1, "games": 1})
    users_list = list(users_list)
    # for user in users_list:
    #     u = user
    #     u["losses"] = user["games"] - user["wins"]
    #     u.pop("games")
    #     users_dict.append(u)
    newlist = sorted(users_list, key=lambda d: d['wins'], reverse=True)
    # root = tk.Tk()
    # Not sure on how to make this a GUI that's pretty and accessible in game so just gonna make an html page for now
    print("You did something not useless good job")
    username = session.get("username")
    return render_template("leaderboard.html", username=username, users_list=newlist)


    


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
        current_app.logger.info(f"{request.remote_addr} attempted register: {username} — failed (invalid password format)")
        return "Password must be stronger", 400

    if mongo.db.users.find_one({"username": username}):
        current_app.logger.info(f"{request.remote_addr} attempted register: {username} — failed (username exists)")
        return "Username exists", 400

    hashed_pw = generate_password_hash(password)
    mongo.db.users.insert_one({"username": username, "password": hashed_pw, "wins": 0, "games": 0})
    session["username"] = username
    current_app.logger.info(f"{request.remote_addr} register: {username} — success")
    return redirect(url_for("main.index"))


@main.route("/login", methods=["POST"])
def login():
    username = request.form.get("username")
    password = request.form.get("password")

    user = mongo.db.users.find_one({"username": username})
    if not user:
        current_app.logger.info(f"{request.remote_addr} login attempt: {username} — failed (user not found)")
        return "Invalid username", 401

    if not check_password_hash(user["password"], password):
        current_app.logger.info(f"{request.remote_addr} login attempt: {username} — failed (wrong password)")
        return "Invalid password", 401

    session["username"] = username
    current_app.logger.info(f"{request.remote_addr} login: {username} — success")
    return redirect(url_for("main.index"))

@main.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.index"))