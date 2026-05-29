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
    }

    namespace.UIScene = UIScene;
})(window.RainbowStreet = window.RainbowStreet || {});
