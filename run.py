from app import create_app, socketio
import traceback

app = create_app()

@app.errorhandler(Exception)
def log_exception(e):
    app.logger.error("Exception occurred", exc_info=e)
    return "Internal server error", 500

if __name__ == "__main__":
    print("[SUCCESS] Launching Flask app on http://127.0.0.1:8080")
    socketio.run(app, host="127.0.0.1", port=8080)