(function (namespace) {
    class GameScene extends Phaser.Scene {
        constructor() {
            super("GameScene");
            this.cameraController = null;
            this.trackManager = null;
            this.matchState = namespace.MATCH_STATE.WAITING;
            this.countdownSteps = [];
            this.countdownIndex = 0;
            this.countdownText = "";
            this.matchEndTime = 0;
            this.remainingMatchTimeMs = namespace.CONFIG.match_duration_ms;
            this.winnerText = "";
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
            this.beginMatchCountdown();
        }

        update() {
            namespace.handleMovement(this.player1, this.p1Keys, 1, this.matchState);
            namespace.handleMovement(this.player2, this.p2Keys, 1, this.matchState);
            this.trackManager.update();
            this.cameraController.update();
            this.updateMatchClock();
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
            this.player1.setScale(0.34);
            this.player1.setOrigin(0.5, 0.72);
            this.physics.add.existing(this.player1);
            this.player1.body.setSize(112, 44, true);
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

        beginMatchCountdown() {
            this.matchState = namespace.MATCH_STATE.COUNTDOWN;
            this.countdownSteps = ["3", "2", "1", "GO!"];
            this.countdownIndex = 0;
            this.countdownText = this.countdownSteps[0];
            this.winnerText = "";
            this.remainingMatchTimeMs = namespace.CONFIG.match_duration_ms;

            this.events.emit("match-state-changed", this.getMatchDebugState());
            this.events.emit("countdown-changed", this.countdownText);
            this.events.emit("match-time-updated", namespace.formatMatchTime(this.remainingMatchTimeMs));

            this.scheduleNextCountdownStep();
        }

        scheduleNextCountdownStep() {
            if (this.countdownIndex >= this.countdownSteps.length - 1) {
                this.time.delayedCall(1000, () => this.startRace());
                return;
            }

            this.time.delayedCall(1000, () => {
                this.countdownIndex += 1;
                this.countdownText = this.countdownSteps[this.countdownIndex];
                this.events.emit("countdown-changed", this.countdownText);
                this.scheduleNextCountdownStep();
            });
        }

        startRace() {
            if (this.matchState === namespace.MATCH_STATE.RACING) {
                return;
            }

            this.matchState = namespace.MATCH_STATE.RACING;
            this.matchEndTime = this.time.now + namespace.CONFIG.match_duration_ms;
            this.remainingMatchTimeMs = namespace.CONFIG.match_duration_ms;

            this.events.emit("match-state-changed", this.getMatchDebugState());
            this.events.emit("countdown-changed", "");
            this.events.emit("match-time-updated", namespace.formatMatchTime(this.remainingMatchTimeMs));
        }

        updateMatchClock() {
            if (this.matchState !== namespace.MATCH_STATE.RACING) {
                return;
            }

            this.remainingMatchTimeMs = Math.max(0, this.matchEndTime - this.time.now);
            this.events.emit("match-time-updated", namespace.formatMatchTime(this.remainingMatchTimeMs));

            if (this.remainingMatchTimeMs <= 0) {
                this.finishRace();
            }
        }

        finishRace() {
            if (this.matchState === namespace.MATCH_STATE.FINISHED) {
                return;
            }

            this.matchState = namespace.MATCH_STATE.FINISHED;
            const winner = this.player1.x >= this.player2.x ? "PLAYER 1" : "PLAYER 2";
            this.winnerText = `${winner} WINS!`;

            this.events.emit("match-state-changed", this.getMatchDebugState());
            this.events.emit("match-finished", this.winnerText);
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

        getMatchDebugState() {
            return {
                state: this.matchState,
                countdownText: this.countdownText,
                timerText: namespace.formatMatchTime(this.remainingMatchTimeMs),
                remainingMatchTimeMs: this.remainingMatchTimeMs,
                winnerText: this.winnerText
            };
        }
    }

    namespace.GameScene = GameScene;
})(window.RainbowStreet = window.RainbowStreet || {});
