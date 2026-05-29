(function (namespace) {
    class GameScene extends Phaser.Scene {
        constructor() {
            super("GameScene");
            this.cameraController = null;
            this.trackManager = null;
        }

        preload() {
            this.load.image("player1-unicorn", "sprites/unidash_drive.png");
        }

        create() {
            this.setupWorld();
            this.setupPlayers();
            this.setupInputs();
            this.setupCameraSystem();
            this.setupTrackSystem();
            this.setupCollisions();
            this.logStartupPositions();

            this.scene.launch("UIScene");
        }

        update() {
            namespace.handleMovement(this.player1, this.p1Keys);
            namespace.handleMovement(this.player2, this.p2Keys);
            this.trackManager.update();
            this.cameraController.update();
        }

        setupWorld() {
            this.physics.world.setBounds(0, 0, namespace.CONFIG.world.width_px * 2, namespace.CONFIG.world.height_px);
            this.floorSegments = [
                this.createFloorSegment(0),
                this.createFloorSegment(namespace.CONFIG.world.width_px)
            ];
        }

        setupPlayers() {
            this.player1 = this.add.sprite(200, 500, "player1-unicorn");
            this.player1.setScale(0.22);
            this.physics.add.existing(this.player1);
            this.player1.body.setSize(96, 48, true);
            namespace.setupPlayerPhysics(this.player1);

            this.player2 = this.add.rectangle(900, 500, 120, 60, 0xff7f50);
            this.physics.add.existing(this.player2);
            namespace.setupPlayerPhysics(this.player2);
        }

        setupCollisions() {
            for (const floorSegment of this.floorSegments) {
                this.physics.add.collider(this.player1, floorSegment);
                this.physics.add.collider(this.player2, floorSegment);
            }

            this.physics.add.collider(
                this.player1,
                this.trackManager.conePool,
                this.handleObstacleCollision,
                null,
                this
            );
            this.physics.add.collider(
                this.player1,
                this.trackManager.barrierPool,
                this.handleObstacleCollision,
                null,
                this
            );
            this.physics.add.collider(
                this.player2,
                this.trackManager.conePool,
                this.handleObstacleCollision,
                null,
                this
            );
            this.physics.add.collider(
                this.player2,
                this.trackManager.barrierPool,
                this.handleObstacleCollision,
                null,
                this
            );
            this.physics.add.collider(this.player1, this.player2, namespace.handlePlayerCollision, null, this);
        }

        setupInputs() {
            this.p1Keys = {
                accel: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
                brake: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
            };

            this.p2Keys = {
                accel: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
                brake: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
                jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
                boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
            };
        }

        setupCameraSystem() {
            this.cameraController = new namespace.CameraController(this, this.player1, this.player2);
            this.cameraController.setup();
        }

        setupTrackSystem() {
            this.trackManager = new namespace.TrackManager(this, this.floorSegments, [this.player1, this.player2]);
        }

        createFloorSegment(startX) {
            const floor = this.add.rectangle(
                startX + (namespace.CONFIG.world.width_px / 2),
                namespace.CONFIG.world.floor_y,
                namespace.CONFIG.world.width_px,
                80,
                0x333344
            );

            floor.setData("chunkStart", startX);
            floor.setData("chunkWidth", namespace.CONFIG.world.width_px);
            this.physics.add.existing(floor, true);

            return floor;
        }

        handleObstacleCollision(player, obstacle) {
            if (!obstacle.active) {
                return;
            }

            const penaltyMultiplier = 1 - (obstacle.getData("speedPenaltyPercent") / 100);
            const nextVelocityX = Math.max(0, player.body.velocity.x * penaltyMultiplier);

            player.body.setVelocityX(nextVelocityX);
            this.trackManager.hideObstacle(obstacle);
        }

        logStartupPositions() {
            const playerPositions = [
                {
                    player: "player1",
                    x: Math.round(this.player1.x),
                    y: Math.round(this.player1.y)
                },
                {
                    player: "player2",
                    x: Math.round(this.player2.x),
                    y: Math.round(this.player2.y)
                }
            ];
            const obstaclePositions = this.trackManager.getActiveObstacleSnapshot();

            console.log("[startup] vehicles", playerPositions);
            console.log("[startup] obstacles", obstaclePositions);
        }

        getCameraDebugState() {
            return this.cameraController.getDebugState();
        }
    }

    namespace.GameScene = GameScene;
})(window.RainbowStreet = window.RainbowStreet || {});
