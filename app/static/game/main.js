let player;
let usernameText;
// let avatar;
const worldWidth = 2000;
const worldHeight = 2000;
let rpsInProgress = false;
let rpsOpponentId = null;
let rpsMyWins = 0;
let rpsTheirWins = 0;
let rpsMyChoice = null;
let myWinLabel = null;
let challengePrompt = null;
let leaderboardContainer = null;
let leaderboardText = null;
let touchPoint = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
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
    
    // Add touch controls for mobile
    if (isMobile) {
        // Create a touch indicator
        touchPoint = this.add.circle(0, 0, 20, 0xff0000, 0.3);
        touchPoint.setVisible(false);
        touchPoint.setScrollFactor(0);
        touchPoint.setDepth(1000);

        // Handle touch events
        this.input.on('pointerdown', (pointer) => {
            touchPoint.setPosition(pointer.x, pointer.y);
            touchPoint.setVisible(true);
        });

        this.input.on('pointermove', (pointer) => {
            if (touchPoint.visible) {
                touchPoint.setPosition(pointer.x, pointer.y);
            }
        });

        this.input.on('pointerup', () => {
            touchPoint.setVisible(false);
        });
    }

    this.input.keyboard.on('keydown-E', () => {
        console.log("E pressed");
        if (!player.emoting) {
            console.log("player is NOT emoting");
            triggerEmote.call(this);
            socket.emit("emote", { id: socket.id });
        }
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

    // avatar = this.physics.add.sprite(worldWidth / 2, worldHeight / 2, 'avatar');

    player.setDepth(1);
    usernameText.setDepth(2);
    // avatar.setDepth(2);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.anims.create({
        key: 'emote_anim',
        frames: this.anims.generateFrameNumbers('emote', { start: 0, end: 17 }), // Replace N!
        frameRate: 12,
        repeat: -1
    });
    myWinLabel = this.add.text(0, 0, "Wins: 0", {
        font: "14px Arial",
        fill: "#ffff00",
        backgroundColor: "#000"
    }).setOrigin(0.5, 1.2);

   
 
    // CONNECT SOCKET HERE:
    socket = io();

    socket.on("connect", () => {
        console.log("Connected with socket ID:", socket.id);
    });

    // Player Disconnection Handling
    socket.on("player_disconnect", (data) => {
        const id = data.sid;
        if (otherPlayers[id]) {
            otherPlayers[id].sprite.destroy();
            otherPlayers[id].label.destroy();
            otherPlayers[id].winLabel.destroy();
            if (otherPlayers[id].avatar) {
                otherPlayers[id].avatar.destroy();
            }
            delete otherPlayers[id];
        }
    });

    socket.on("player_data", (data) => {
        for (let id in data) {
            const { username, x, y, wins = 0, avatar_path } = data[id];
            
            if (!otherPlayers[id]) { 
                const sprite = game.scene.keys.default.physics.add.sprite(x, y, "player");
                sprite.setInteractive({ useHandCursor: true });

                // Add click handler for player interaction
                sprite.on('pointerdown', () => {
                    openChallengeMenu(username, id);
                });

                const label = game.scene.keys.default.add.text(x, y - 32, username || "???", {
                    font: "16px Arial",
                    fill: "#fff",
                    backgroundColor: "#000"
                }).setOrigin(0.5, 1.2);

                const winLabel = game.scene.keys.default.add.text(x, y - 16, `Wins: ${wins}`, {
                    font: "14px Arial",
                    fill: "#ffff00",
                    backgroundColor: "#000"
                }).setOrigin(0.5, 1.2);

                otherPlayers[id] = { sprite, label, winLabel };

                // Dynamically load the avatar image
                if (avatar_path) {
                    const scene = game.scene.keys.default;
                    scene.load.image(`avatar_${id}`, avatar_path);
                    scene.load.once("complete", () => {
                        const avatar = scene.add.image(x, y, `avatar_${id}`);
                        avatar.setDepth(2);
                        otherPlayers[id].avatar = avatar;
                    });
                    scene.load.start();
                }
            } else {
                // Update existing player's wins label
                otherPlayers[id].winLabel.setText(`Wins: ${wins}`);
            }

            // Update position and labels
            otherPlayers[id].sprite.setPosition(x, y);
            otherPlayers[id].label.setPosition(x, y - 32);
            otherPlayers[id].winLabel.setPosition(x, y - 16);
            if (otherPlayers[id].avatar) {
                otherPlayers[id].avatar.setPosition(x - 50, y - 32);
            }
        }
    });

    // Generate the Map
    socket.on("map_seed", (data) => {
        mapSeed = data.seed;
        Math.seedrandom(mapSeed); // 🔐 Use the shared seed

        console.log("Map seed received:", mapSeed);
        generateMap.call(this); // Generate map with seed
    });

    socket.on("emote", ({ id }) => {
        const target = otherPlayers[id];
        if (target && target.sprite) {
            target.sprite.play('emote_anim');
    
            // Stop after 3 seconds
            this.time.delayedCall(3000, () => {
                target.sprite.setTexture('player');
            });
        }
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
        
        // Create Phaser UI for challenge prompt
        const scene = game.scene.keys.default;
        if (challengePrompt) challengePrompt.destroy();

        const cam = scene.cameras.main;
        const centerX = cam.scrollX + cam.width / 2;
        const centerY = cam.scrollY + cam.height / 2;

        challengePrompt = scene.add.container(centerX, centerY).setDepth(9999);

        // Background
        const bg = scene.add.rectangle(0, 0, 300, 200, 0x222222, 0.9).setOrigin(0.5);
        challengePrompt.add(bg);

        // Title
        const title = scene.add.text(0, -60, "Challenge Received!", {
            font: '20px Arial',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        challengePrompt.add(title);

        // Message
        const message = scene.add.text(0, -20, `${fromName} challenged you to Rock Paper Scissors!`, {
            font: '16px Arial',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 250 }
        }).setOrigin(0.5);
        challengePrompt.add(message);

        // Accept button
        const acceptButton = scene.add.text(0, 30, "Accept", {
            font: '18px Arial',
            fill: '#00ff00',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        acceptButton.on('pointerdown', () => {
            rpsOpponentId = fromId;
            rpsInProgress = true;
            socket.emit("rps_accept", { from: fromId });
            showRPSPopup();
            challengePrompt.destroy();
            challengePrompt = null;
        });
        
        challengePrompt.add(acceptButton);

        // Decline button
        const declineButton = scene.add.text(0, 70, "Decline", {
            font: '18px Arial',
            fill: '#ff0000',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        declineButton.on('pointerdown', () => {
            socket.emit("rps_decline", { from: fromId });
            console.log("who declined: ", fromId);
            challengePrompt.destroy();
            challengePrompt = null;
        });
        
        challengePrompt.add(declineButton);
        
        scene.add.existing(challengePrompt);
    });
    
    socket.on("rps_round_result", ({ you, opponent, roundId }) => {
        if (!rpsInProgress) return;

        // Generate a unique round ID if not provided
        const currentRoundId = roundId || `${you}-${opponent}-${Date.now()}`;
        
        // Check if this round has already been processed
        if (rpsGame.processedRounds.has(currentRoundId)) {
            console.log(`Skipping duplicate round: ${currentRoundId}`);
            return;
        }
        
        // Mark this round as processed
        rpsGame.processedRounds.add(currentRoundId);
        
        console.log(`RPS round result: You chose ${you}, opponent chose ${opponent}, round ID: ${currentRoundId}`);

        if (rpsGame.resultText) {
            rpsGame.resultText.setText(`You chose ${you}, opponent chose ${opponent}`);
        }

        let outcome = "draw";
        if (you === opponent) {
            outcome = "draw";
            if (rpsGame.resultText) {
                rpsGame.resultText.setText(`You chose ${you}, opponent chose ${opponent}. It's a draw!`);
            }
        } else if (
            (you === "rock" && opponent === "scissors") ||
            (you === "paper" && opponent === "rock") ||
            (you === "scissors" && opponent === "paper")
        ) {
            outcome = "win";
            const index = rpsMyWins + rpsTheirWins;
            if (rpsGame.circles && rpsGame.circles[index]) {
                rpsGame.circles[index].setFillStyle(0x00ff00); // Green for win
            }
            if (rpsGame.resultText) {
                rpsGame.resultText.setText(`You chose ${you}, opponent chose ${opponent}. You win this round!`);
            }
            rpsMyWins++;
        } else {
            outcome = "loss";
            const index = rpsMyWins + rpsTheirWins;
            if (rpsGame.circles && rpsGame.circles[index]) {
                rpsGame.circles[index].setFillStyle(0xff0000); // Red for loss
            }
            if (rpsGame.resultText) {
                rpsGame.resultText.setText(`You chose ${you}, opponent chose ${opponent}. You lose this round.`);
            }
            rpsTheirWins++;
        }

        // Reset button states
        if (rpsGame.choiceButtons) {
            rpsGame.choiceButtons.list.forEach(button => {
                button.list[0].setFillStyle(0x444444);
                button.list[0].setAlpha(1);
            });
        }

        rpsMyChoice = null;
        rpsGame.locked = false;

        if ((rpsMyWins === 2 || rpsTheirWins === 2) && !rpsGame.gameComplete) {
            rpsGame.gameComplete = true;
            
            // Show final result
            if (rpsGame.resultText) {
                const finalResult = rpsMyWins === 2 ? "You won the game!" : "You lost the game.";
                rpsGame.resultText.setText(`Game over! ${finalResult}`);
            }
            
            // Only the winner should send the rps_complete event
            // This ensures the win is only counted once
            if (rpsMyWins === 2) {
                setTimeout(() => {
                    console.log("✅ Emitting rps_complete with opponentId:", rpsOpponentId);
                    hideRPSPopup();
                    socket.emit("rps_complete", {
                        winner: socket.id,
                        loser: rpsOpponentId
                    });
                }, 2000);
            } else {
                // If the player lost, just hide the popup after a delay
                setTimeout(() => {
                    hideRPSPopup();
                }, 2000);
            }
        }
    });
    
    socket.on("rps_complete", () => {
        // Reset all game state
        rpsInProgress = false;
        rpsOpponentId = null;
        rpsMyWins = 0;
        rpsTheirWins = 0;
        rpsMyChoice = null;
        rpsGame.gameComplete = false;
        rpsGame.processedRounds.clear(); // Clear processed rounds
        rpsGame.locked = false; // Reset the lock
        
        // Clean up UI if it exists
        if (rpsGame.ui) {
            rpsGame.ui.destroy();
            rpsGame.ui = null;
        }
    });

    // Create leaderboard container
    leaderboardContainer = this.add.container(0, 0);
    leaderboardContainer.setScrollFactor(0); // Make it fixed to the camera
    leaderboardContainer.setDepth(1000); // Ensure it's always on top

    // Create semi-transparent background for leaderboard
    const leaderboardBg = this.add.rectangle(0, 0, 200, 150, 0x000000, 0.5);
    leaderboardBg.setOrigin(0, 0);
    leaderboardContainer.add(leaderboardBg);

    // Create leaderboard title
    const leaderboardTitle = this.add.text(10, 10, "Leaderboard", {
        font: "16px Arial",
        fill: "#ffffff"
    });
    leaderboardContainer.add(leaderboardTitle);

    // Create leaderboard text
    leaderboardText = this.add.text(10, 40, "", {
        font: "14px Arial",
        fill: "#ffffff"
    });
    leaderboardContainer.add(leaderboardText);

    // Position the leaderboard in the top right corner
    leaderboardContainer.setPosition(window.innerWidth - 210, 10);

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

    socket.on("leaderboard_update", (leaderboardData) => {
        if (!leaderboardText) return;

        let leaderboardString = "";
        leaderboardData.forEach((player, index) => {
            const losses = player.games - player.wins;
            leaderboardString += `${index + 1}. ${player.username}\n`;
            leaderboardString += `   Wins: ${player.wins} | Losses: ${losses}\n\n`;
        });

        leaderboardText.setText(leaderboardString);
    });
}


const game = new Phaser.Game(config);
// Dynamic window resizing
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
    game.scene.scenes.forEach(scene => {
        if (scene.cameras && scene.cameras.main) {
            scene.cameras.main.setSize(window.innerWidth, window.innerHeight);
        }
        // Reposition leaderboard
        if (leaderboardContainer) {
            leaderboardContainer.setPosition(window.innerWidth - 210, 10);
        }
    });
});


let challengeMenu;


function openChallengeMenu(targetUsername, targetSid) {
    if (socket.id == targetSid) {
        console.log("You cannot challenge yourself.");
        return;
    }
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
    this.load.spritesheet('emote', '/static/game/assets/emote3.webp', {
        frameWidth: 640, //85 // change if your emote frame size is different
        frameHeight: 634 // 84
    });
    this.load.once('complete', () => {
        const frameTotal = this.textures.get('emote').frameTotal;
        console.log(`🧩 Emote frame count: ${frameTotal}`);
    });
    this.load.image('player', '/static/game/assets/player.png');
    // this.load.image('avatar', avatar_path);
    this.load.image('tiles', '/static/game/assets/custom_grass.png');

    this.load.image('mushrooms', '/static/game/assets/custom_mushroom.png');
    this.load.image('tree', '/static/game/assets/custom_tree.png');
    this.load.image('golden_tree', '/static/game/assets/custom_golden_tree.png');
    this.load.image('house', '/static/game/assets/custom_house.png');
    this.load.image('flowers', '/static/game/assets/custom_flowers.png');


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


function generateMapOLD() {
    const tileSize = 16;
    const tilesPerRow = Math.floor(worldWidth / tileSize);
    const tilesPerCol = Math.floor(worldHeight / tileSize);
    const chunkSize = 32;
    const biomeTypes = ['plains', 'forest', 'village'];
    const biomeMap = {};

    const occupied = new Set(); // Track used tile positions for houses


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
            //this.add.sprite(x * tileSize, y * tileSize, 'tiles', 0).setOrigin(0);
            this.add.sprite(x * tileSize, y * tileSize, 'tiles').setOrigin(0);

            let tileIndex = null;
            const roll = Math.random();

            if (biome === 'forest') {
                if (roll < 0.1) tileIndex = 4;   // pine tree
                else if (roll < 0.18) tileIndex = 5; // golden tree
                else if (roll < 0.30) tileIndex = 7; // mushrooms
                else if (roll < 0.45) tileIndex = 8 //flowers

            } else if (biome === 'village') {
                if (roll < 0.05) {
                    const houseTiles = [
                        `${x},${y}`,
                        `${x+1},${y}`,
                        `${x},${y+1}`,
                        `${x+1},${y+1}`
                    ];
                
                    const overlaps = houseTiles.some(pos => occupied.has(pos));
                
                    if (!overlaps && x < tilesPerRow - 1 && y < tilesPerCol - 1) {
                        this.add.sprite((x-1) * tileSize, (y-1) * tileSize, 'house')
                            .setOrigin(0)
                            .setDisplaySize(tileSize * 2, tileSize * 2); // <- scale to 64x64
                        houseTiles.forEach(pos => occupied.add(pos));
                    }
                }
                else if (roll < 0.3){
                    tileIndex = 8 //flowers
                }
            } else if (biome === 'plains') {
                if (roll < 0.1) tileIndex = 7; // mushrooms
                else if (roll < 0.3) tileIndex = 8;
            }

            if (tileIndex !== null) {

                if (tileIndex == 7){
                    this.add.sprite(x * tileSize, y * tileSize, 'mushrooms').setOrigin(0)
                }
                else if (tileIndex == 4){
                    this.add.sprite(x * tileSize, (y - 1) * tileSize, 'tree').setOrigin(0, 0);
                }
                else if (tileIndex == 5){
                    this.add.sprite(x * tileSize, (y - 1) * tileSize, 'golden_tree').setOrigin(0, 0);
                }
                else if (tileIndex == 8){
                    this.add.sprite(x * tileSize, y * tileSize, 'flowers').setOrigin(0)
                }
                else{
                    this.add.sprite(x * tileSize, y * tileSize, 'tiles', tileIndex).setOrigin(0);
                }
                
            }
        }
    }
}


function update() {
    player.setVelocity(0);

    if (isMobile && touchPoint && touchPoint.visible) {
        // Convert touch coordinates to world coordinates
        const worldPoint = this.cameras.main.getWorldPoint(touchPoint.x, touchPoint.y);
        
        // Calculate direction vector from player to touch point
        const dx = worldPoint.x - player.x;
        const dy = worldPoint.y - player.y;
        
        // Calculate distance
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize and apply velocity if there's significant distance
        if (distance > 5) {
            const speed = 200;
            player.setVelocity(
                (dx / distance) * speed,
                (dy / distance) * speed
            );
        }
    } else {
        // Keyboard controls for non-mobile
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
        myWinLabel.setPosition(player.x, player.y - 16);
    }
    
    // if (avatar && player) {
    //     avatar.setPosition(player.x - 50, usernameText.y);
    // }
    // avatar.setPosition(player.x - 50, usernameText.y);

}

let rpsGame = {
    rounds: [],
    opponentId: null,
    locked: false,
    ui: null,
    resultText: null,
    choiceButtons: null,
    circles: [],
    gameComplete: false,
    processedRounds: new Set() // Track processed rounds to prevent duplicates
};

function openRPSPopup(opponentId) {
    rpsGame.rounds = [];
    rpsGame.opponentId = opponentId;
    rpsGame.locked = false;
    rpsGame.gameComplete = false;

    // Create Phaser UI for RPS game
    const scene = game.scene.keys.default;
    if (rpsGame.ui) rpsGame.ui.destroy();

    const cam = scene.cameras.main;
    const centerX = cam.scrollX + cam.width / 2;
    const centerY = cam.scrollY + cam.height / 2;

    // Calculate dimensions based on screen size
    const width = isMobile ? Math.min(window.innerWidth * 0.9, 600) : 400;
    const height = isMobile ? Math.min(window.innerHeight * 0.8, 500) : 300;
    const buttonWidth = isMobile ? Math.min(width * 0.25, 120) : 100;
    const buttonHeight = isMobile ? 60 : 50;
    const fontSize = isMobile ? '24px' : '18px';
    const titleFontSize = isMobile ? '32px' : '24px';

    // Create container for RPS UI
    rpsGame.ui = scene.add.container(centerX, centerY).setDepth(9999);

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, 0x222222, 0.9).setOrigin(0.5);
    rpsGame.ui.add(bg);

    // Title
    const title = scene.add.text(0, -height/2 + 40, "Rock Paper Scissors", {
        font: `${titleFontSize} Arial`,
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);
    rpsGame.ui.add(title);

    // Result text
    rpsGame.resultText = scene.add.text(0, -height/2 + 100, "", {
        font: `${fontSize} Arial`,
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);
    rpsGame.ui.add(rpsGame.resultText);

    // Choice buttons
    rpsGame.choiceButtons = scene.add.container(0, 0);
    
    const choices = ["rock", "paper", "scissors"];
    const spacing = isMobile ? 30 : 20;
    const totalWidth = (buttonWidth * 3) + (spacing * 2);
    const startX = -totalWidth / 2 + buttonWidth / 2;

    choices.forEach((choice, index) => {
        const x = startX + (index * (buttonWidth + spacing));
        
        // Create a container for the button
        const button = scene.add.container(x, 0);
        
        // Add background rectangle
        const buttonBg = scene.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x444444).setOrigin(0.5);
        
        // Add text
        const buttonText = scene.add.text(0, 0, choice.charAt(0).toUpperCase() + choice.slice(1), {
            font: `${fontSize} Arial`,
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // Add elements to the button container
        button.add([buttonBg, buttonText]);
        
        // Make the entire button interactive
        button.setSize(buttonWidth, buttonHeight);
        button.setInteractive({ useHandCursor: true });
        
        // Add pointerdown event
        button.on('pointerdown', () => {
            if (!rpsGame.locked) {
                console.log(`Selected ${choice}`);
                selectRPS(choice);
            }
        });
        
        // Add hover effect
        button.on('pointerover', () => {
            buttonBg.setFillStyle(0x666666);
        });
        
        button.on('pointerout', () => {
            buttonBg.setFillStyle(0x444444);
        });
        
        // Add to the choice buttons container
        rpsGame.choiceButtons.add(button);
    });
    
    rpsGame.ui.add(rpsGame.choiceButtons);

    // Win/loss circles
    rpsGame.circles = [];
    const circleRadius = isMobile ? 25 : 15;
    const circleSpacing = isMobile ? 60 : 40;
    const circlesStartX = -circleSpacing;
    
    for (let i = 0; i < 3; i++) {
        const x = circlesStartX + (i * circleSpacing);
        const circle = scene.add.circle(x, height/2 - 60, circleRadius, 0x888888);
        rpsGame.circles.push(circle);
        rpsGame.ui.add(circle);
    }

    // Close button
    const closeButton = scene.add.text(0, height/2 - 40, "Close", {
        font: `${fontSize} Arial`,
        fill: '#ff0000',
        backgroundColor: '#000',
        padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    closeButton.on('pointerdown', () => {
        closeRPSPopup();
    });
    
    rpsGame.ui.add(closeButton);
    
    scene.add.existing(rpsGame.ui);
}

function closeRPSPopup() {
    if (rpsGame.ui) {
        rpsInProgress = false;
        rpsGame.ui.destroy();
        rpsGame.ui = null;
    }
}

function showRPSPopup() {
    if (!rpsGame.ui) {
        openRPSPopup(rpsGame.opponentId);
    }
}

function hideRPSPopup() {
    closeRPSPopup();
}

function resetRPSDisplay() {
    rpsMyWins = 0;
    rpsTheirWins = 0;
    rpsMyChoice = null;
    
    if (rpsGame.circles) {
        rpsGame.circles.forEach(circle => {
            circle.setFillStyle(0x888888);
        });
    }
    
    if (rpsGame.resultText) {
        rpsGame.resultText.setText("");
    }
}

function selectRPS(choice) {
    if (!rpsInProgress || rpsMyChoice || rpsGame.locked) {
        console.log("Cannot select: game not in progress, choice already made, or game locked");
        return;
    }
    
    console.log(`Making RPS choice: ${choice}`);
    rpsMyChoice = choice;
    rpsGame.locked = true;
    
    // Generate a unique round ID
    const roundId = `${choice}-${Date.now()}`;
    
    // Visual feedback for selection
    if (rpsGame.choiceButtons) {
        rpsGame.choiceButtons.list.forEach(button => {
            const buttonText = button.list[1];
            if (buttonText.text.toLowerCase() === choice) {
                // Highlight selected choice
                button.list[0].setFillStyle(0x00aa00);
            } else {
                // Dim other choices
                button.list[0].setFillStyle(0x333333);
                button.list[0].setAlpha(0.5);
            }
        });
    }
    
    if (rpsGame.resultText) {
        rpsGame.resultText.setText(`You chose ${choice}. Waiting for opponent...`);
    }
    
    // Send choice to server with round ID
    socket.emit("rps_choice", {
        to: rpsOpponentId,
        choice: rpsMyChoice,
        roundId: roundId
    });
}


function triggerEmote() {
    player.emoting = true;
    player.play('emote_anim');
    
    this.time.delayedCall(3000, () => {
        player.stop();
        player.setTexture('player');
        //player.setFrame(0);
        player.emoting = false;
    });
}


function generateMap() {
    //const tileSize = 16;
    const tileSize = 32
    const tilesPerRow = Math.floor(worldWidth / tileSize);
    const tilesPerCol = Math.floor(worldHeight / tileSize);
    const chunkSize = 16;
    const biomeTypes = ['plains', 'forest', 'village'];
    const biomeMap = {};

    const occupied = new Set(); // Track used tile positions for houses

    // Assign a biome to each chunk
    for (let chunkY = 0; chunkY < tilesPerCol / chunkSize; chunkY++) {
        for (let chunkX = 0; chunkX < tilesPerRow / chunkSize; chunkX++) {
            const key = `${chunkX},${chunkY}`;
            biomeMap[key] = biomeTypes[Math.floor(Math.random() * biomeTypes.length)];
        }
    }
{

}

    for (let y = 0; y < tilesPerCol; y++) {
        for (let x = 0; x < tilesPerRow; x++) {
            const chunkX = Math.floor(x / chunkSize);
            const chunkY = Math.floor(y / chunkSize);
            const biome = biomeMap[`${chunkX},${chunkY}`];

            // Always draw grass
            //this.add.sprite(x * tileSize, y * tileSize, 'tiles', 0).setOrigin(0);
            this.add.sprite(x * tileSize, y * tileSize, 'tiles').setOrigin(0);

            let tileIndex = null;
            const roll = Math.random();

            if (biome === 'forest') {
                if (roll < 0.1) tileIndex = 4;   // pine tree
                else if (roll < 0.18) tileIndex = 5; // golden tree
                else if (roll < 0.30) tileIndex = 7; // mushrooms
                else if (roll < 0.45) tileIndex = 8 //flowers

            } else if (biome === 'village') {
                if (roll < 0.05) {
                    const houseTiles = [
                        `${x},${y}`,
                        `${x+1},${y}`,
                        `${x},${y+1}`,
                        `${x+1},${y+1}`
                    ];
                
                    const overlaps = houseTiles.some(pos => occupied.has(pos));
                
                    if (!overlaps && x < tilesPerRow - 1 && y < tilesPerCol - 1) {
                        this.add.sprite((x-1) * tileSize, (y-1) * tileSize, 'house')
                            .setOrigin(0)
                            .setDisplaySize(tileSize * 2, tileSize * 2); // <- scale to 64x64
                        houseTiles.forEach(pos => occupied.add(pos));
                    }
                }
                else if (roll < 0.15){
                    tileIndex = 8 //flowers
                }
            } else if (biome === 'plains') {
                if (roll < 0.1) tileIndex = 7; // mushrooms
                else if (roll < 0.2) tileIndex = 8; //flowers
                else if (roll < 0.23) tileIndex = 4; //tree
            }

            if (tileIndex !== null) {

                if (tileIndex == 7){
                    this.add.sprite(x * tileSize, y * tileSize, 'mushrooms').setOrigin(0)
                }
                else if (tileIndex == 4){
                    this.add.sprite(x * tileSize, (y - 1) * tileSize, 'tree').setOrigin(0, 0);
                }
                else if (tileIndex == 5){
                    this.add.sprite(x * tileSize, (y - 1) * tileSize, 'golden_tree').setOrigin(0, 0);
                }
                else if (tileIndex == 8){
                    this.add.sprite(x * tileSize, y * tileSize, 'flowers').setOrigin(0)
                }
                else{
                    this.add.sprite(x * tileSize, y * tileSize, 'tiles', tileIndex).setOrigin(0);
                }
                
            }
        }
    }
        
}