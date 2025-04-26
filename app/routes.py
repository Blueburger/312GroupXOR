from flask import Blueprint, render_template, request, redirect, url_for, flash, session, current_app
from app import mongo
from werkzeug.security import generate_password_hash, check_password_hash
import os, re, uuid, hashlib
from uuid import uuid4

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
    
    # Ensure all users have the required fields with default values
    for user in users_list:
        if "wins" not in user:
            user["wins"] = 0
        if "games" not in user:
            user["games"] = 0
    
    # Sort by wins in descending order
    newlist = sorted(users_list, key=lambda d: d.get('wins', 0), reverse=True)
    
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

    if not username or not password:
        current_app.logger.info(f"{request.remote_addr} register attempt: {username} — failed (missing fields)")
        return "Missing username or password", 400

    if not password_is_valid(password):
        current_app.logger.info(f"{request.remote_addr} register attempt: {username} — failed (invalid password)")
        return "Password must be at least 8 characters long and contain at least one number", 400

    try:
        # Check if username already exists
        existing_user = mongo.db.users.find_one({"username": username})
        if existing_user:
            current_app.logger.info(f"{request.remote_addr} register attempt: {username} — failed (username taken)")
            return "Username already taken", 409

        # Create new user with default values for wins and games
        hashed_password = generate_password_hash(password)
        mongo.db.users.insert_one({
            "username": username,
            "password": hashed_password,
            "avatar_path": None,
            "wins": 0,
            "games": 0
        })

        session["username"] = username
        current_app.logger.info(f"{request.remote_addr} register: {username} — success")
        return "Success", 200
    except Exception as e:
        current_app.logger.error(f"Database error during registration: {str(e)}")
        return "Database connection error. Please try again later.", 500

@main.route("/login", methods=["POST"])
def login():
    username = request.form.get("username")
    password = request.form.get("password")

    try:
        user = mongo.db.users.find_one({"username": username})
        if not user:
            current_app.logger.info(f"{request.remote_addr} login attempt: {username} — failed (user not found)")
            return "Invalid username", 401

        if not check_password_hash(user["password"], password):
            current_app.logger.info(f"{request.remote_addr} login attempt: {username} — failed (wrong password)")
            return "Invalid password", 401

        session["username"] = username
        current_app.logger.info(f"{request.remote_addr} login: {username} — success")
        return "Success", 200
    except Exception as e:
        current_app.logger.error(f"Database error during login: {str(e)}")
        return "Database connection error. Please try again later.", 500

@main.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.index"))

@main.route("/upload-custom-avatar", methods=["POST"])
def upload_custom_avatar():
    # get avatar image bytes from form
    avatar = request.files['avatar']
    try:
        # get file extension from filename
        if avatar.content_type == 'image/jpeg':
            file_ext = '.jpeg'
        elif avatar.content_type == 'image/png':
            file_ext = '.png'
        elif avatar.content_type == 'image/svg+xml':
            file_ext = '.svg'
        elif avatar.content_type == 'image/webp':
            file_ext = '.webp'
        else:
            try:
                file_ext = avatar.filename[avatar.filename.rindex('.'):]
            except ValueError as e:
                current_app.logger.error(f"Error uploading avatar: {str(e)}")
                return f"Error uploading avatar: Bad file type\n{str(e)}.", 400
        # generate unique filename for uploaded avatar
        avatar_path = os.path.join(current_app.root_path, "static", "game", "assets", str(uuid4()) + file_ext)
        existing_user = mongo.db.users.find_one({"avatar_path": avatar_path})
        while existing_user:
            avatar_path = os.path.join(current_app.root_path, "static", "game", "assets", str(uuid4()))
            existing_user = mongo.db.users.find_one({"avatar_path": avatar_path})
        # save avatar image to file on disk
        avatar.save(avatar_path)
        return "Successfully uploaded custom avatar.", 200
    except Exception as e:
        current_app.logger.error(f"Error uploading avatar: {str(e)}")
        return f"Error uploading avatar: {str(e)}. Please try again later.", 500 