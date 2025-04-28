# for avatar upload
import os
import subprocess
from uuid import uuid4

from PIL import Image, ImageOps
from flask import session, current_app

from app import mongo


def get_file_ext(filename: str, content_type: str):
    if content_type == 'image/jpeg':
        return '.jpeg'
    elif content_type == 'image/png':
        return '.png'
    elif content_type == 'image/svg+xml':
        return '.svg'
    elif content_type == 'image/webp':
        return '.webp'
    else:
        return filename[filename.rindex('.'):]


# for avatar upload
def generate_unique_filename(file_ext: str):
    avatar_path = os.path.join("static", "game", "assets", str(uuid4()) + file_ext)
    existing_user = mongo.db.users.find_one({"avatar_path": avatar_path})
    while existing_user:
        avatar_path = os.path.join("static", "game", "assets", str(uuid4()) + file_ext)
        existing_user = mongo.db.users.find_one({"avatar_path": avatar_path})
    return avatar_path


# for avatar upload
def cleanup_previous_avatar():
    # get path of current player's previous avatar
    current_user_previous_avatar_path = mongo.db.users.find_one({'username': session.get('username')})['avatar_path']
    # delete previous image
    if current_user_previous_avatar_path:
        try:
            os.remove(os.path.join('app', current_user_previous_avatar_path))
        except Exception as e:
            # DEBUG
            current_app.logger.error("Error removing file: \n" + str(e))
            completed = subprocess.run(["pwd"], capture_output=True)
            current_app.logger.info("Current directory: " + completed.stdout.decode())
            if completed.stderr:
                current_app.logger.error("Error" + completed.stderr.decode())

            completed = subprocess.run(["ls", "-R"], capture_output=True)
            current_app.logger.info("Structure: " + completed.stdout.decode())
            if completed.stderr:
                current_app.logger.error("Error " + completed.stderr.decode())
            ## DEBUG


# for avatar upload
def process_avatar(file_path):
    with Image.open(file_path) as avatar:
        ImageOps.contain(avatar, (40, 40)).save(file_path)