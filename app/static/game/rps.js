// rps.js
export function initializeRPS(socket, {
    setOpponentId,
    setInProgress,
    showPopup,
    hidePopup,
    updateWinLabel
}) {
    let rpsMyWins = 0;
    let rpsTheirWins = 0;
    let rpsMyChoice = null;
    let rpsOpponentId = null;
    let rpsInProgress = false;

    function resetRPSDisplay() {
        rpsMyWins = 0;
        rpsTheirWins = 0;
        rpsMyChoice = null;
        for (let i = 1; i <= 3; i++) {
            const circle = document.getElementById(`rps-circle-${i}`);
            circle.className = "rps-circle";
        }
        document.getElementById("rps-result").innerText = "";
    }

    function selectRPS(choice) {
        if (!rpsInProgress || rpsMyChoice) return;
        rpsMyChoice = choice;
        socket.emit("rps_choice", {
            to: rpsOpponentId,
            choice: rpsMyChoice
        });
        document.getElementById("rps-result").innerText = `Waiting for opponent...`;
    }

    socket.on("rps_challenge_accepted", ({ byId }) => {
        rpsOpponentId = byId;
        rpsInProgress = true;
        showPopup();
    });

    socket.on("rps_challenge_declined", () => {
        rpsInProgress = false;
        alert("Your challenge was declined.");
    });

    socket.on("rps_challenge_received", ({ fromId, fromName }) => {
        if (rpsInProgress) {
            console.warn("❌ Received a challenge while a game is already in progress.");
            return;
        }

        const accept = confirm(`${fromName} challenged you to Rock Paper Scissors!`);
        if (accept) {
            rpsOpponentId = fromId;
            rpsInProgress = true;
            socket.emit("rps_accept", { from: fromId });
            showPopup();
        } else {
            socket.emit("rps_decline", { from: fromId });
        }
    });

    socket.on("rps_round_result", ({ you, opponent }) => {
        if (!rpsInProgress) return;

        document.getElementById("rps-result").innerText = `You chose ${you}, opponent chose ${opponent}`;
        let outcome = "draw";
        const index = rpsMyWins + rpsTheirWins + 1;

        if (you !== opponent) {
            const win = (you === "rock" && opponent === "scissors") ||
                        (you === "paper" && opponent === "rock") ||
                        (you === "scissors" && opponent === "paper");

            if (win) {
                document.getElementById(`rps-circle-${index}`).classList.add("win");
                rpsMyWins++;
            } else {
                document.getElementById(`rps-circle-${index}`).classList.add("loss");
                rpsTheirWins++;
            }
        }

        rpsMyChoice = null;

        if (rpsMyWins === 2 || rpsTheirWins === 2) {
            setTimeout(() => {
                hidePopup();
                socket.emit("rps_complete", {
                    opponentId: rpsOpponentId,
                    result: rpsMyWins === 2 ? "win" : "loss"
                });
                if (rpsMyWins === 2) updateWinLabel(); // tell main.js to update label
            }, 1500);
        }
    });

    socket.on("rps_complete", () => {
        rpsInProgress = false;
        rpsOpponentId = null;
        rpsMyWins = 0;
        rpsTheirWins = 0;
        rpsMyChoice = null;
    });

    return {
        selectRPS
    };
}