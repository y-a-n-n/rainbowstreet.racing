(function (namespace) {
    class UIScene extends Phaser.Scene {
        constructor() {
            super("UIScene");
        }

        create() {
            this.gameScene = this.scene.get("GameScene");

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
    }

    namespace.UIScene = UIScene;
})(window.RainbowStreet = window.RainbowStreet || {});
