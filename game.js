(function (namespace) {
    const config = {
        type: Phaser.AUTO,
        width: 1280,
        height: 720,
        parent: "game-container",
        backgroundColor: "#1a1a2e",
        physics: {
            default: "arcade",
            arcade: {
                gravity: { y: namespace.CONFIG.world.gravity_y },
                debug: true
            }
        },
        scene: [namespace.GameScene, namespace.UIScene]
    };

    namespace.gameConfig = config;
    namespace.game = new Phaser.Game(config);
    window.__rainbowStreetGame = namespace.game;
})(window.RainbowStreet = window.RainbowStreet || {});
