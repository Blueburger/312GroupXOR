const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload: function () {
            this.load.image('sky', '/static/game/assets/sky.png');

        },
        create: function () {
            this.add.image(400, 300, 'sky');
        }
    }
};

const game = new Phaser.Game(config);