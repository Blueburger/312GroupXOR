from flask_socketio import emit, join_room, leave_room
from flask import session, request
from app import socketio
import time

players = {}  # { sid: { username, x, y } }

@socketio.on("connect")
def on_connect():
    username = session.get("username", "anon")
    sid = request.sid
    players[sid] = {"username": username, "x": 0, "y": 0}
    print(f"{username} connected with SID {sid}")
    emit("player_data", players, broadcast=True)

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    players.pop(sid, None)
    emit("player_data", players, broadcast=True)

@socketio.on("move")
def on_move(data):
    sid = request.sid
    if sid in players:
        players[sid]["x"] = data["x"]
        players[sid]["y"] = data["y"]
        print(f"{players[sid]['username']} moved to {data['x']}, {data['y']}")
    emit("player_data", players, broadcast=True)