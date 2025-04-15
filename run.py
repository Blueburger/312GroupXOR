from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    print("[SUCCESS] Launching Flask app on http://127.0.0.1:8080")




    socketio.run(app, host="127.0.0.1", port=8080)