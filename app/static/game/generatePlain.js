function generatePlainsBiome(canvasId) {
    const tileSize = 32;
    const tilesPerRow = Math.ceil(window.innerWidth / tileSize);
    const tilesPerCol = Math.ceil(window.innerHeight / tileSize);

    const canvas = document.getElementById(canvasId);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');

    const assets = {
        grass: new Image(),
        mushrooms: new Image(),
        flowers: new Image(),
        tree: new Image(),
        sparce_flowers: new Image()
    };

    assets.grass.src = "/static/game/assets/custom_grass.png";
    assets.mushrooms.src = "/static/game/assets/custom_mushroom.png";
    assets.flowers.src = "/static/game/assets/custom_flowers.png";
    assets.tree.src = "/static/game/assets/custom_tree.png";
    assets.sparce_flowers.src = "/static/game/assets/custom_sparce_flowers.png";

    const draw = () => {
        for (let y = 0; y < tilesPerCol; y++) {
            for (let x = 0; x < tilesPerRow; x++) {
                const px = x * tileSize;
                const py = y * tileSize;

                ctx.drawImage(assets.grass, px, py, tileSize, tileSize);

                const roll = Math.random();
                if (roll < 0.1) {
                    ctx.drawImage(assets.mushrooms, px, py, tileSize, tileSize);
                } else if (roll < 0.13) {
                    ctx.drawImage(assets.flowers, px, py, tileSize, tileSize);
                } else if (roll < 0.2) {
                    ctx.drawImage(assets.sparce_flowers, px, py, tileSize, tileSize);
                } else if (roll < 0.21){
                    ctx.drawImage(assets.tree, px, py - tileSize, tileSize, tileSize * 2);
                }
                
            }
        }
    };

    let loaded = 0;
    const totalAssets = Object.keys(assets).length;
    Object.values(assets).forEach(img => {
        img.onload = () => {
            loaded++;
            if (loaded === totalAssets) draw();
        };
    });
}
