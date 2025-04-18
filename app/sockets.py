from flask_socketio import emit, join_room, leave_room
from flask import session, request
from app import socketio
import time
import random
import string


players = {}  # { sid: { username, x, y } }

# Track active RPS games: { tuple(sorted([player1_sid, player2_sid])): { choices, wins } }
active_rps_games = {}

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
    "y": spawn_y,
    "wins": 0  # 🟢 Track wins
    }

    # Send shared map seed
    emit("map_seed", {"seed": MAP_SEED})
    
    # Send all existing player data to this new player
    emit("player_data", players, to=sid)

    # Send only the new player to others
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




def evaluate_rps(p1_choice, p2_choice):
    beats = {
        "rock": "scissors",
        "paper": "rock",
        "scissors": "paper"
    }
    if p1_choice == p2_choice:
        return "draw"
    elif beats[p1_choice] == p2_choice:
        return "p1"
    else:
        return "p2"

@socketio.on("rps_challenge")
def handle_rps_challenge(data):
    from_sid = request.sid
    to_sid = data.get("to") or data.get("target")  # Accept both
    from_username = players.get(from_sid, {}).get("username", "???")
    print(f"[RPS] {from_username} is challenging SID {to_sid}")

    if not to_sid or to_sid not in players:
        print("⚠️ Invalid or missing opponent SID:", to_sid)
        return

    if to_sid in players:
        emit("rps_challenge_received", {
            "fromId": from_sid,
            "fromName": from_username
        }, to=to_sid)


@socketio.on("rps_accept")
def handle_rps_accept(data):
    from_sid = data.get("from")
    to_sid = request.sid  # the player accepting

    key = tuple(sorted([from_sid, to_sid]))
    active_rps_games[key] = {
        "choices": {},
        "wins": {from_sid: 0, to_sid: 0}
    }

    emit("rps_challenge_accepted", { "byId": to_sid }, to=from_sid)

@socketio.on("rps_decline")
def handle_rps_decline(data):
    from_sid = data.get("from")
    emit("rps_challenge_declined", to=from_sid)


@socketio.on("rps_choice")
def handle_rps_choice(data):
    from_sid = request.sid
    to_sid = data.get("to")
    choice = data.get("choice")

    key = tuple(sorted([from_sid, to_sid]))
    game = active_rps_games.get(key)
    if not game:
        return

    game["choices"][from_sid] = choice

    if len(game["choices"]) < 2:
        return  # wait for both choices

    # Evaluate round
    p1, p2 = key
    c1 = game["choices"][p1]
    c2 = game["choices"][p2]

    outcome = evaluate_rps(c1, c2)

    if outcome == "p1":
        game["wins"][p1] += 1
    elif outcome == "p2":
        game["wins"][p2] += 1
    # else draw, no points

    # Emit round result to both players
    emit("rps_round_result", {
        "you": c1,
        "opponent": c2
    }, to=p1)

    emit("rps_round_result", {
        "you": c2,
        "opponent": c1
    }, to=p2)

    game["choices"] = {}  # reset for next round

@socketio.on("rps_complete")
def handle_rps_complete(data):
    from_sid = request.sid
    opponent_sid = data.get("opponentId")

    if not opponent_sid or opponent_sid not in players:
        print("⚠️ Invalid or missing opponent SID:", opponent_sid)
        return  # Skip rest to avoid crashing

    result = data.get("result")
    key = tuple(sorted([from_sid, opponent_sid]))

    if key in active_rps_games:
        del active_rps_games[key]

    emit("rps_complete", to=from_sid)
    emit("rps_complete", to=opponent_sid)

    # Logging and win tracking
    try:
        winner = players[from_sid]['username'] if result == "win" else players[opponent_sid]['username']
        loser = players[opponent_sid]['username'] if result == "win" else players[from_sid]['username']
        print(f"{winner} won against {loser}")
    except:
        print("⚠️ Could not resolve usernames for result log.")

    if result == "win":
        players[from_sid]["wins"] += 1
    elif result == "loss":
        players[opponent_sid]["wins"] += 1

    emit("player_data", players, broadcast=True)