let player;
let usernameText;
const worldWidth = 2000;
const worldHeight = 2000;
let rpsInProgress = false;
let rpsOpponentId = null;
let rpsMyWins = 0;
let rpsTheirWins = 0;
let rpsMyChoice = null;
let myWinLabel = null;
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

let socket;
let otherPlayers = {};
let mapSeed = null;

function create() {
    const seed = 'world1'; // Replace with value from server in future
    Math.seedrandom(seed);
    const graphics = this.add.graphics();

    this.input.enabled = true;  // Add this at the beginning of create()
    
    this.input.on('pointerdown', (pointer) => {
        console.log(`Clicked at ${pointer.x}, ${pointer.y}`);
    });



    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    player = this.physics.add.sprite(worldWidth / 2, worldHeight / 2, 'player');
    player.setCollideWorldBounds(true);
    

    this.cameras.main.startFollow(player, true, 0.08, 0.08);

    usernameText = this.add.text(0, 0, username || '???', {
        font: '16px Arial',
        fill: '#ffffff',
        backgroundColor: '#000000'
    });
    usernameText.setOrigin(0.5, 1.2);

    player.setDepth(1);
    usernameText.setDepth(2);   

    this.cursors = this.input.keyboard.createCursorKeys();

    myWinLabel = this.add.text(0, 0, "Wins: 0", {
        font: "14px Arial",
        fill: "#ffff00"
    }).setOrigin(0.5);

   


    // CONNECT SOCKET HERE:
    socket = io();
    //socket.onAny((event, ...args) => {
    //    console.log("📥 Caught event:", event, args);
    //});

    socket.on("connect", () => {
        console.log("Connected with socket ID:", socket.id);
    });


    // Player Disconnection Handling
    socket.on("remove_player", (data) => {
        const id = data.id;
        if (otherPlayers[id]) {
            otherPlayers[id].sprite.destroy();
            otherPlayers[id].label.destroy();
            delete otherPlayers[id];
        }
    });

    socket.on("player_data", (data) => {
        // Clean up players no longer in the data
        for (let id in otherPlayers) {
            if (!data[id]) {
                otherPlayers[id].sprite.destroy();
                otherPlayers[id].label.destroy();
                otherPlayers[id].winLabel.destroy();
                delete otherPlayers[id];
            }
        }
    
        for (let id in data) {
            const { username, x, y, wins = 0 } = data[id];
    
            // All players now get handled — even the local player
            if (!otherPlayers[id]) {
                const sprite = game.scene.keys.default.physics.add.sprite(x, y, "player");
                sprite.setInteractive({ useHandCursor: true });
    
                const label = game.scene.keys.default.add.text(x, y - 32, username || "???", {
                    font: "16px Arial",
                    fill: "#fff",
                    backgroundColor: "#000"
                }).setOrigin(0.5, 1.2);
    
                const winLabel = game.scene.keys.default.add.text(x, y - 50, `Wins: ${wins}`, {
                    font: "14px Arial",
                    fill: "#ffff00"
                }).setOrigin(0.5);
    
                // Only allow opening challenge menu if this is not the local player
                if (id !== socket.id) {
                    sprite.on("pointerdown", () => {
                        if (!rpsInProgress && !challengeMenu) {
                            console.log(`[RPS] Opening challenge menu for ${username} (SID: ${id})`);
                            openChallengeMenu(username, id);
                        }
                    });
                }
    
                otherPlayers[id] = { sprite, label, winLabel };
            }
    
            // Always update position and label content
            otherPlayers[id].sprite.setPosition(x, y);
            otherPlayers[id].label.setPosition(x, y - 32);
            otherPlayers[id].winLabel.setPosition(x, y - 50);
            otherPlayers[id].winLabel.setText(`Wins: ${wins}`);
        }
    });
    // Generate the Map
    socket.on("map_seed", (data) => {
        mapSeed = data.seed;
        Math.seedrandom(mapSeed); // 🔐 Use the shared seed

        console.log("Map seed received:", mapSeed);
        generateMap.call(this); // Generate map with seed
    });

    
    socket.on("rps_challenge_accepted", ({ byId }) => {
        rpsOpponentId = byId;
        rpsInProgress = true;
        showRPSPopup();
    });
    
    socket.on("rps_challenge_declined", () => {
        rpsInProgress = false;  // ✅ Allow re-challenges
        alert("Your challenge was declined.");
    });

    socket.on("rps_challenge_received", ({ fromId, fromName }) => {
        if (rpsInProgress) {
            console.warn("❌ Received a challenge while a game is already in progress.");
            return;
        }
    
        console.log("🎮 Received challenge from", fromId, fromName);
        const accept = confirm(`${fromName} challenged you to Rock Paper Scissors!`);
        if (accept) {
            rpsOpponentId = fromId;
            rpsInProgress = true;
            socket.emit("rps_accept", { from: fromId });
            showRPSPopup();
        } else {
            socket.emit("rps_decline", { from: fromId });
            console.log("who declined: ", fromId);
        }
    });
    
    socket.on("rps_round_result", ({ you, opponent }) => {
        if (!rpsInProgress) return;
    
        document.getElementById("rps-result").innerText = `You chose ${you}, opponent chose ${opponent}`;
    
        let outcome = "draw";
        if (you === opponent) {
            outcome = "draw";
        } else if (
            (you === "rock" && opponent === "scissors") ||
            (you === "paper" && opponent === "rock") ||
            (you === "scissors" && opponent === "paper")
        ) {
            outcome = "win";
            const index = rpsMyWins + rpsTheirWins + 1;
            document.getElementById(`rps-circle-${index}`).classList.add("win");
            rpsMyWins++;
        } else {
            outcome = "loss";
            const index = rpsMyWins + rpsTheirWins + 1;
            document.getElementById(`rps-circle-${index}`).classList.add("loss");
            rpsTheirWins++;
        }
    
        rpsMyChoice = null;
    
        if (rpsMyWins === 2 || rpsTheirWins === 2) {
            setTimeout(() => {
                console.log("✅ Emitting rps_complete with opponentId:", rpsOpponentId);
                hideRPSPopup();
                socket.emit("rps_complete", {
                    opponentId: rpsOpponentId,
                    result: rpsMyWins === 2 ? "win" : "loss"
                });
            }, 1500);
        }
    });
    
    // ✅ Reset flags after game complete
    socket.on("rps_complete", () => {
        rpsInProgress = false;
        rpsOpponentId = null;
        rpsMyWins = 0;
        rpsTheirWins = 0;
        rpsMyChoice = null;
    });


    // Optional: draw grid and border
    //graphics.lineStyle(4, 0xffffff);
    //graphics.strokeRect(0, 0, worldWidth, worldHeight);

    for (let x = 0; x < worldWidth; x += 100) {
        graphics.lineStyle(1, 0x444444);
        graphics.beginPath();
        graphics.moveTo(x, 0);
        graphics.lineTo(x, worldHeight);
        graphics.strokePath();
    }
    for (let y = 0; y < worldHeight; y += 100) {
        graphics.lineStyle(1, 0x444444);
        graphics.beginPath();
        graphics.moveTo(0, y);
        graphics.lineTo(worldWidth, y);
        graphics.strokePath();
    }
}


const game = new Phaser.Game(config);


let challengeMenu;

function openChallengeMenu(targetUsername, targetSid) {
    console.log("🧩 Opening challenge menu for SID:", targetSid);  // Debug log
    if (!targetSid) {
        console.warn("⚠️ No target SID provided for challenge menu.");
        return;
    }
    const scene = game.scene.keys.default;
    if (challengeMenu) challengeMenu.destroy();

    const cam = scene.cameras.main;
    const menuX = cam.scrollX + cam.width / 2;
    const menuY = cam.scrollY + cam.height / 2;

    challengeMenu = scene.add.container(menuX, menuY).setDepth(9999);

    const bg = scene.add.rectangle(0, 0, 260, 140, 0x222222).setOrigin(0.5);
    const text = scene.add.text(0, -40, `Challenge ${targetUsername}?`, {
        font: '16px Arial',
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);

    const challengeButton = scene.add.text(0, 10, "Challenge to RPS", {
        font: '16px Arial',
        fill: '#00ff00',
        backgroundColor: '#000',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const closeButton = scene.add.text(0, 50, "Cancel", {
        font: '16px Arial',
        fill: '#ff0000',
        backgroundColor: '#000',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    challengeButton.on("pointerdown", () => {
        if (!rpsInProgress) {
            console.log("[DEBUG] Sending challenge to:", targetSid);
            socket.emit("rps_challenge", { to: targetSid });
            challengeMenu.destroy();
            challengeMenu = null;
        }
    });

    closeButton.on("pointerdown", () => {
        challengeMenu.destroy();
        challengeMenu = null;
    });

    challengeMenu.add([bg, text, challengeButton, closeButton]);
    scene.add.existing(challengeMenu);
    console.log("✅ Challenge menu rendered for", targetUsername);
}




function preload() {
    this.load.image('player', '/static/game/assets/player.png');
    this.load.spritesheet('tiles', '/static/game/assets/tilemap_packed.png', {
        frameWidth: 32,
        frameHeight: 32
    });
    this.load.once('complete', () => {
        const frameTotal = this.textures.get('tiles').frameTotal;
        const sheetTexture = this.textures.get('tiles').getSourceImage();
        const tileWidth = 64;
        const tileHeight = 64;
        const columns = Math.floor(sheetTexture.width / tileWidth);
        const rows = Math.floor(sheetTexture.height / tileHeight);
    
        console.log(`📦 Loaded tilesheet with ${frameTotal} frames`);
        console.log(`🧮 Dimensions: ${columns} columns × ${rows} rows`);
    });
}


function generateMap() {
    const tileSize = 32;
    const tilesPerRow = Math.floor(worldWidth / tileSize);
    const tilesPerCol = Math.floor(worldHeight / tileSize);
    const chunkSize = 10;
    const biomeTypes = ['plains', 'forest', 'village'];
    const biomeMap = {};

    // Assign a biome to each chunk
    for (let chunkY = 0; chunkY < tilesPerCol / chunkSize; chunkY++) {
        for (let chunkX = 0; chunkX < tilesPerRow / chunkSize; chunkX++) {
            const key = `${chunkX},${chunkY}`;
            biomeMap[key] = biomeTypes[Math.floor(Math.random() * biomeTypes.length)];
        }
    }

    for (let y = 0; y < tilesPerCol; y++) {
        for (let x = 0; x < tilesPerRow; x++) {
            const chunkX = Math.floor(x / chunkSize);
            const chunkY = Math.floor(y / chunkSize);
            const biome = biomeMap[`${chunkX},${chunkY}`];

            // Always draw grass
            this.add.sprite(x * tileSize, y * tileSize, 'tiles', 0).setOrigin(0);

            let tileIndex = null;
            const roll = Math.random();

            if (biome === 'forest') {
                if (roll < 0.1) tileIndex = 4;   // pine tree
                else if (roll < 0.18) tileIndex = 5; // golden tree
                else if (roll < 0.20) tileIndex = 7; // mushrooms

            } else if (biome === 'village') {
                if (roll < 0.05) {
                    // Cluster a 2x2 house structure
                    const structure = [
                        [8, 9],  // top row
                        [10, 11] // bottom row
                    ];
                    for (let dx = 0; dx < 2; dx++) {
                        for (let dy = 0; dy < 2; dy++) {
                            const tx = x + dx;
                            const ty = y + dy;
                            if (tx < tilesPerRow && ty < tilesPerCol) {
                                this.add.sprite(tx * tileSize, ty * tileSize, 'tiles', structure[dy][dx]).setOrigin(0);
                            }
                        }
                    }
                }
            } else if (biome === 'plains') {
                if (roll < 0.02) tileIndex = 7; // mushrooms
            }

            if (tileIndex !== null) {
                this.add.sprite(x * tileSize, y * tileSize, 'tiles', tileIndex).setOrigin(0);
            }
        }
    }
}


function update() {
    player.setVelocity(0);

    if (this.cursors.left.isDown) {
        player.setVelocityX(-200);
    } else if (this.cursors.right.isDown) {
        player.setVelocityX(200);
    }

    if (this.cursors.up.isDown) {
        player.setVelocityY(-200);
    } else if (this.cursors.down.isDown) {
        player.setVelocityY(200);
    }
    // Send position to server
    if (socket && socket.connected) {
        socket.emit("move", { x: player.x, y: player.y });
    }

    // Update label position
    usernameText.x = player.x;
    usernameText.y = player.y - 32;
    if (usernameText && player) {
        usernameText.setPosition(player.x, player.y - 32);
    }
    usernameText.setPosition(player.x, player.y - 32);
    if (myWinLabel) {
        myWinLabel.setPosition(player.x, player.y - 50);
    }
}

let rpsGame = {
    rounds: [],
    opponentId: null,
    locked: false
};

function openRPSPopup(opponentId) {
    rpsGame.rounds = [];
    rpsGame.opponentId = opponentId;
    rpsGame.locked = false;

    document.getElementById("rps-result").textContent = "";
    [...document.querySelectorAll(".rps-circle")].forEach(c => {
        c.classList.remove("win", "loss");
    });

    document.getElementById("rps-popup").style.display = "block";
}

function closeRPSPopup() {
    document.getElementById("rps-popup").style.display = "none";
}



function showRPSPopup() {
    document.getElementById("rps-popup").style.display = "block";
    resetRPSDisplay();
}

function hideRPSPopup() {
    document.getElementById("rps-popup").style.display = "none";
}

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