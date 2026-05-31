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
            this.catchUpState = {
                active: false,
                leader: null,
                trailer: null,
                distanceX: 0,
                modifiers: {
                    1: { accelerationModifier: 1, speedModifier: 1 },
                    2: { accelerationModifier: 1, speedModifier: 1 }
                },
                regenProgressMs: {
                    1: 0,
                    2: 0
                }
            };
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

        update(time, delta) {
            this.updateCatchUpState(delta);
            namespace.handleMovement(this.player1, this.p1Keys, this.catchUpState.modifiers[1], this.matchState);
            namespace.handleMovement(this.player2, this.p2Keys, this.catchUpState.modifiers[2], this.matchState);
            this.trackManager.update();
            this.cameraController.update();
            this.updateMatchClock();
        }

        setupWorld() {
            const floorSegmentCount = namespace.CONFIG.track_system.floor_segment_count;
            this.physics.world.setBounds(
                0,
                0,
                namespace.CONFIG.world.width_px * floorSegmentCount,
                namespace.CONFIG.world.height_px
            );
            this.floorSegments = Array.from({ length: floorSegmentCount }, (_, index) =>
                this.createFloorSegment(namespace.CONFIG.world.width_px * index)
            );
        }

        setupPlayers() {
            this.player1 = this.add.sprite(200, 500, "player1-unicorn");
            this.player1.setScale(0.34);
            this.player1.setOrigin(0.5, 0.72);
            this.physics.add.existing(this.player1);
            this.player1.body.setSize(112, 44, true);
            this.player1.playerNumber = 1;
            namespace.initializeBoostState(this.player1, namespace.CONFIG.boost_economy.starting_bars);
            namespace.setupPlayerPhysics(this.player1);

            this.player2 = this.add.rectangle(900, 500, 120, 60, 0xff7f50);
            this.physics.add.existing(this.player2);
            this.player2.playerNumber = 2;
            namespace.initializeBoostState(this.player2, namespace.CONFIG.boost_economy.starting_bars);
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

            this.showBonkPopup(player);
            player.body.setVelocityX(nextVelocityX);
            this.trackManager.hideObstacle(obstacle);
        }

        startPlayerBoost(player) {
            if (player.state !== "NORMAL" || player.boostCharges <= 0) {
                return false;
            }

            this.setPlayerBoostCharges(player, player.boostCharges - 1);
            player.state = "BOOSTING";

            if (player.boostTimer) {
                player.boostTimer.remove(false);
                player.boostTimer = null;
            }

            player.boostTimer = this.time.delayedCall(namespace.CONFIG.boost_economy.duration_ms, () => {
                if (player.state === "BOOSTING") {
                    player.state = "NORMAL";
                }
                player.boostTimer = null;
            });

            return true;
        }

        setPlayerBoostCharges(player, nextCharges) {
            const cappedCharges = Phaser.Math.Clamp(nextCharges, 0, namespace.CONFIG.boost_economy.max_bars);

            if (player.boostCharges === cappedCharges) {
                return cappedCharges;
            }

            const playerNumber = this.getPlayerNumber(player);
            player.boostCharges = cappedCharges;
            if (cappedCharges >= namespace.CONFIG.boost_economy.max_bars) {
                this.catchUpState.regenProgressMs[playerNumber] = 0;
            }

            this.events.emit("boost-changed", {
                player: playerNumber,
                charges: cappedCharges
            });

            return cappedCharges;
        }

        awardBoostCharge(player, amount = namespace.CONFIG.boost_economy.jump_clearance_reward) {
            const previousCharges = player.boostCharges;
            const nextCharges = this.setPlayerBoostCharges(player, player.boostCharges + amount);

            if (nextCharges > previousCharges) {
                this.showBoostRefillPopup(player, nextCharges - previousCharges);
                this.events.emit("boost-refilled", {
                    player: this.getPlayerNumber(player),
                    charges: nextCharges
                });
            }

            return nextCharges;
        }

        updateCatchUpState(delta = 0) {
            const config = namespace.CONFIG.catch_up_system;
            const deltaX = this.player1.x - this.player2.x;
            const distanceX = Math.abs(deltaX);
            const leader = deltaX >= 0 ? 1 : 2;
            const trailer = leader === 1 ? 2 : 1;
            const isActive = this.matchState === namespace.MATCH_STATE.RACING
                && distanceX > config.activation_distance_px;
            const accelerationBonus = 1 + (config.trailing_accel_bonus_percent / 100);
            const speedBonus = 1 + (config.trailing_speed_bonus_percent / 100);

            this.catchUpState.active = isActive;
            this.catchUpState.leader = isActive ? leader : null;
            this.catchUpState.trailer = isActive ? trailer : null;
            this.catchUpState.distanceX = distanceX;
            this.catchUpState.modifiers[1] = { accelerationModifier: 1, speedModifier: 1 };
            this.catchUpState.modifiers[2] = { accelerationModifier: 1, speedModifier: 1 };

            if (isActive) {
                this.catchUpState.modifiers[trailer] = {
                    accelerationModifier: accelerationBonus,
                    speedModifier: speedBonus
                };
                this.updateTrailingBoostRegen(trailer, delta);
            }

            this.events.emit("catch-up-changed", this.getCatchUpDebugState());
        }

        updateTrailingBoostRegen(playerNumber, delta) {
            const player = playerNumber === 1 ? this.player1 : this.player2;
            const config = namespace.CONFIG.catch_up_system;

            if (player.boostCharges >= namespace.CONFIG.boost_economy.max_bars) {
                this.catchUpState.regenProgressMs[playerNumber] = 0;
                return;
            }

            this.catchUpState.regenProgressMs[playerNumber] += delta;

            while (
                this.catchUpState.regenProgressMs[playerNumber] >= config.trailing_passive_regen_ms
                && player.boostCharges < namespace.CONFIG.boost_economy.max_bars
            ) {
                this.catchUpState.regenProgressMs[playerNumber] -= config.trailing_passive_regen_ms;
                this.awardBoostCharge(player);
            }

            if (player.boostCharges >= namespace.CONFIG.boost_economy.max_bars) {
                this.catchUpState.regenProgressMs[playerNumber] = 0;
            }
        }

        getPlayerNumber(player) {
            return player.playerNumber ?? (player === this.player1 ? 1 : 2);
        }

        showBoostRefillPopup(player, amount) {
            const popup = this.add.text(player.x, player.y - 90, `BOOST +${amount}`, {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#f8f32b",
                stroke: "#1a1a2e",
                strokeThickness: 4
            });
            popup.setOrigin(0.5, 0.5);
            popup.setDepth(1000);

            this.tweens.add({
                targets: popup,
                y: popup.y - 30,
                alpha: 0,
                duration: 700,
                ease: "Sine.easeOut",
                onComplete: () => popup.destroy()
            });
        }

        showBonkPopup(player) {
            const popup = this.add.text(player.x, player.y - 76, "BONK!", {
                fontFamily: "monospace",
                fontSize: "20px",
                color: "#ffffff",
                stroke: "#ff355e",
                strokeThickness: 5
            });
            popup.setOrigin(0.5, 0.5);
            popup.setDepth(1000);

            this.tweens.add({
                targets: popup,
                y: popup.y - 24,
                alpha: 0,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 520,
                ease: "Back.easeOut",
                onComplete: () => popup.destroy()
            });
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

        getBoostDebugState() {
            return {
                player1: {
                    charges: this.player1.boostCharges,
                    state: this.player1.state
                },
                player2: {
                    charges: this.player2.boostCharges,
                    state: this.player2.state
                }
            };
        }

        getCatchUpDebugState() {
            const regenDuration = namespace.CONFIG.catch_up_system.trailing_passive_regen_ms;

            return {
                active: this.catchUpState.active,
                leader: this.catchUpState.leader,
                trailer: this.catchUpState.trailer,
                distanceX: this.catchUpState.distanceX,
                player1Progress: this.catchUpState.regenProgressMs[1] / regenDuration,
                player2Progress: this.catchUpState.regenProgressMs[2] / regenDuration,
                player1Modifiers: this.catchUpState.modifiers[1],
                player2Modifiers: this.catchUpState.modifiers[2]
            };
        }
    }

    namespace.GameScene = GameScene;
})(window.RainbowStreet = window.RainbowStreet || {});
