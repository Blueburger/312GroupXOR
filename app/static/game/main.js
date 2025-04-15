let player;
let usernameText;
const worldWidth = 2000;
const worldHeight = 2000;

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

function create() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2a2a2a, 1);
    graphics.fillRect(0, 0, worldWidth, worldHeight);

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

    this.cursors = this.input.keyboard.createCursorKeys();

    // ✅ CONNECT SOCKET HERE:
    socket = io();

    socket.on("connect", () => {
        console.log("Connected with socket ID:", socket.id);
    });

    socket.on("player_data", (data) => {
        console.log("Received player data:", data);

        for (let id in otherPlayers) {
            if (!data[id]) {
                otherPlayers[id].sprite.destroy();
                otherPlayers[id].label.destroy();
                delete otherPlayers[id];
            }
        }

        for (let id in data) {
            if (id === socket.id) continue;

            const { username, x, y } = data[id];
            if (!otherPlayers[id]) {
                const sprite = this.physics.add.sprite(x, y, "player");
                const label = this.add.text(x, y - 32, username, {
                    font: "16px Arial",
                    fill: "#fff",
                    backgroundColor: "#000"
                }).setOrigin(0.5, 1.2);

                otherPlayers[id] = { sprite, label };
            } else {
                otherPlayers[id].sprite.setPosition(x, y);
                otherPlayers[id].label.setPosition(x, y - 32);
            }
        }
    });

    // Optional: draw grid and border
    graphics.lineStyle(4, 0xffffff);
    graphics.strokeRect(0, 0, worldWidth, worldHeight);

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

function preload() {
    this.load.image('player', '/static/game/assets/player.png');
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
}


