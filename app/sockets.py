from flask_socketio import emit, join_room, leave_room
from flask import session, request
from app import socketio
import time
import random
import string


players = {}  # { sid: { username, x, y } }

# Generate a shared map seed
MAP_SEED = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

@socketio.on("connect")
def on_connect(auth):
    sid = request.sid
    username = session.get("username", "anon")

    print(f"{username} connected with SID {sid}")

    # Clean up old entries using the same username to avoid duplicates
    to_remove = [key for key, val in players.items() if val["username"] == username]
    for key in to_remove:
        del players[key]

    # Set spawn point randomly
    spawn_x = random.randint(100, 1800)
    spawn_y = random.randint(100, 1800)

    players[sid] = {
        "username": username,
        "x": spawn_x,
        "y": spawn_y
    }

    # Send shared map seed
    emit("map_seed", {"seed": MAP_SEED})

    # Send current state of all players to this new player
    emit("player_data", players, to=sid)

    # Broadcast this new player's data to all *other* clients
    emit("player_data", {sid: players[sid]}, broadcast=True, include_self=False)
    

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    print(f"Client disconnected: {sid}")

    # Check if this sid exists and remove it
    if sid in players:
        # Notify other clients that this player is gone
        emit("player_disconnect", {"sid": sid}, broadcast=True)
        del players[sid]
    else:
        print(f"Warning: SID {sid} not found in players dict")

@socketio.on("move")
def on_move(data):
    sid = request.sid
    if sid in players:
        players[sid]["x"] = data["x"]
        players[sid]["y"] = data["y"]
        #print(f"{players[sid]['username']} moved to {data['x']}, {data['y']}")
    emit("player_data", players, broadcast=True)


