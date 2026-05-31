(function (namespace) {
    class UIScene extends Phaser.Scene {
        constructor() {
            super("UIScene");
        }

        create() {
            this.gameScene = this.scene.get("GameScene");
            this.boostRows = {};

            this.divider = this.add.rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                namespace.CONFIG.camera_system.divider_height_px,
                0xf8f32b
            );
            this.divider.setScrollFactor(0);

            this.stateLabel = this.add.text(24, 20, "", {
                fontFamily: "monospace",
                fontSize: "24px",
                color: "#f8f8ff"
            });
            this.stateLabel.setScrollFactor(0);

            this.distanceLabel = this.add.text(24, 52, "", {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#78f7ff"
            });
            this.distanceLabel.setScrollFactor(0);

            this.createBoostRow(1, 24, 88, 0x78f7ff, "P1 BOOST", "left");
            this.createBoostRow(2, this.scale.width - 24, 20, 0xff7f50, "P2 BOOST", "right");

            this.timerLabel = this.add.text(this.scale.width / 2, 18, "", {
                fontFamily: "monospace",
                fontSize: "28px",
                color: "#f8f32b"
            });
            this.timerLabel.setOrigin(0.5, 0);
            this.timerLabel.setScrollFactor(0);

            this.countdownLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, "", {
                fontFamily: "monospace",
                fontSize: "72px",
                color: "#ffffff",
                stroke: "#1a1a2e",
                strokeThickness: 10
            });
            this.countdownLabel.setOrigin(0.5, 0.5);
            this.countdownLabel.setScrollFactor(0);

            this.resultLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, "", {
                fontFamily: "monospace",
                fontSize: "42px",
                color: "#78f7ff",
                stroke: "#1a1a2e",
                strokeThickness: 8
            });
            this.resultLabel.setOrigin(0.5, 0.5);
            this.resultLabel.setScrollFactor(0);

            this.gameScene.events.on("match-state-changed", this.syncMatchState, this);
            this.gameScene.events.on("countdown-changed", this.setCountdownText, this);
            this.gameScene.events.on("match-time-updated", this.setTimerText, this);
            this.gameScene.events.on("match-finished", this.showResultText, this);
            this.gameScene.events.on("boost-changed", this.onBoostChanged, this);
            this.gameScene.events.on("boost-refilled", this.onBoostRefilled, this);
            this.gameScene.events.on("catch-up-changed", this.onCatchUpChanged, this);

            this.syncFromGameScene();
        }

        update() {
            const cameraState = this.gameScene.getCameraDebugState();

            this.divider.setPosition(this.scale.width / 2, cameraState.dividerY);
            this.divider.setDisplaySize(this.scale.width, namespace.CONFIG.camera_system.divider_height_px);
            this.divider.setVisible(cameraState.state !== namespace.CAMERA_STATE.SHARED);

            this.stateLabel.setText(`Camera: ${cameraState.state}`);
            this.distanceLabel.setText(
                `Distance X: ${Math.round(cameraState.distanceX)} px  Merge < ${cameraState.mergeThreshold}  Split > ${cameraState.splitThreshold}`
            );
        }

        syncFromGameScene() {
            const matchState = this.gameScene.getMatchDebugState();
            this.syncMatchState(matchState);
            this.setCountdownText(matchState.countdownText);
            this.setTimerText(matchState.timerText);
            this.showResultText(matchState.winnerText);

            const boostState = this.gameScene.getBoostDebugState();
            this.setBoostRow(1, boostState.player1.charges);
            this.setBoostRow(2, boostState.player2.charges);

            this.onCatchUpChanged(this.gameScene.getCatchUpDebugState());
        }

        syncMatchState(matchState) {
            this.countdownLabel.setVisible(matchState.state === namespace.MATCH_STATE.COUNTDOWN);
            this.resultLabel.setVisible(matchState.state === namespace.MATCH_STATE.FINISHED);
            this.timerLabel.setVisible(matchState.state !== namespace.MATCH_STATE.WAITING);
        }

        setCountdownText(text) {
            this.countdownLabel.setText(text);
            this.countdownLabel.setVisible(Boolean(text));
        }

        setTimerText(text) {
            this.timerLabel.setText(text);
        }

        showResultText(text) {
            this.resultLabel.setText(text);
            this.resultLabel.setVisible(Boolean(text));
        }

        createBoostRow(playerNumber, x, y, accentColor, labelText, alignment) {
            const label = this.add.text(x, y, labelText, {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#ffffff"
            });
            label.setScrollFactor(0);
            label.setOrigin(alignment === "right" ? 1 : 0, 0);

            const bars = [];
            const progressX = alignment === "right" ? x - 120 : x + 120;
            const progressBack = this.add.circle(progressX, y + 10, 14, accentColor, 0.08);
            progressBack.setScrollFactor(0);
            progressBack.setStrokeStyle(2, 0xffffff, 0.15);

            const progressArc = this.add.arc(progressX, y + 10, 14, -90, -90, false, accentColor, 0.22);
            progressArc.setScrollFactor(0);
            progressArc.setStrokeStyle(3, accentColor, 0.7);

            for (let index = 0; index < namespace.CONFIG.boost_economy.max_bars; index += 1) {
                const barX = alignment === "right"
                    ? x - 120 - (index * 28)
                    : x + 120 + (index * 28);
                const bar = this.add.rectangle(barX, y + 10, 20, 20, accentColor);
                bar.setScrollFactor(0);
                bar.setStrokeStyle(2, 0xffffff);
                bar.setData("accentColor", accentColor);
                bars.push(bar);
            }

            this.boostRows[playerNumber] = {
                label,
                bars,
                progressBack,
                progressArc,
                charges: 0
            };
        }

        setBoostRow(playerNumber, charges) {
            const row = this.boostRows[playerNumber];
            if (!row) {
                return;
            }

            row.charges = charges;
            row.bars.forEach((bar, index) => {
                const isFilled = index < charges;
                bar.setAlpha(isFilled ? 1 : 0.18);
                bar.setFillStyle(bar.getData("accentColor"), isFilled ? 1 : 0.18);
            });
        }

        onBoostChanged(event) {
            this.setBoostRow(event.player, event.charges);
        }

        onBoostRefilled(event) {
            this.flashBoostRow(event.player);
        }

        onCatchUpChanged(event) {
            this.setRegenProgress(1, event.player1Progress, event.active && event.trailer === 1);
            this.setRegenProgress(2, event.player2Progress, event.active && event.trailer === 2);
        }

        setRegenProgress(playerNumber, progress, isActiveTrailer) {
            const row = this.boostRows[playerNumber];
            if (!row) {
                return;
            }

            const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);
            const nextBarIndex = Phaser.Math.Clamp(row.charges, 0, row.bars.length - 1);
            const nextBar = row.bars[nextBarIndex];
            const endAngle = -90 + (360 * clampedProgress);
            row.progressBack.setPosition(nextBar.x, nextBar.y);
            row.progressArc.setPosition(nextBar.x, nextBar.y);
            row.progressArc.setEndAngle(endAngle);
            row.progressBack.setAlpha(clampedProgress > 0 || isActiveTrailer ? 1 : 0);
            row.progressArc.setAlpha(isActiveTrailer ? 0.95 : 0.35);
            row.progressArc.setVisible(clampedProgress > 0 || isActiveTrailer);
            row.progressBack.setVisible(clampedProgress > 0 || isActiveTrailer);
        }

        flashBoostRow(playerNumber) {
            const row = this.boostRows[playerNumber];
            if (!row) {
                return;
            }

            this.tweens.add({
                targets: [row.label, ...row.bars],
                scaleX: 1.08,
                scaleY: 1.08,
                duration: 110,
                yoyo: true,
                ease: "Sine.easeOut"
            });

            row.label.setColor("#f8f32b");
            this.time.delayedCall(140, () => {
                row.label.setColor("#ffffff");
            });
        }
    }

    namespace.UIScene = UIScene;
})(window.RainbowStreet = window.RainbowStreet || {});
