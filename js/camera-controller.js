(function (namespace) {
    class CameraController {
        constructor(scene, player1, player2) {
            this.scene = scene;
            this.player1 = player1;
            this.player2 = player2;
            this.cameraState = namespace.CAMERA_STATE.SHARED;
            this.transitionTweenCount = 0;
        }

        setup() {
            const canvasWidth = this.scene.scale.width;
            const canvasHeight = this.scene.scale.height;
            const halfHeight = canvasHeight / 2;

            this.cameraRig = {
                mainViewport: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
                secondaryViewport: { x: 0, y: canvasHeight, width: canvasWidth, height: 0 },
                mainFocus: { x: 0, y: 0 },
                secondaryFocus: { x: 0, y: 0 }
            };

            this.mainCamera = this.scene.cameras.main;
            this.mainCamera.setBounds(0, 0, namespace.CONFIG.world.width_px, namespace.CONFIG.world.height_px);

            this.secondaryCamera = this.scene.cameras.add(0, halfHeight, canvasWidth, halfHeight);
            this.secondaryCamera.setBounds(0, 0, namespace.CONFIG.world.width_px, namespace.CONFIG.world.height_px);
            this.secondaryCamera.setVisible(false);

            this.midpointTracker = this.scene.add.zone(0, 0, 1, 1);
            this.updateMidpointTracker();
            this.applyViewportState();

            this.mainCamera.startFollow(this.midpointTracker, true);
            this.secondaryCamera.stopFollow();

            this.scene.mainCamera = this.mainCamera;
            this.scene.secondaryCamera = this.secondaryCamera;
            this.scene.midpointTracker = this.midpointTracker;
        }

        update() {
            this.updateMidpointTracker();
            this.evaluateCameraState();
        }

        updateMidpointTracker() {
            this.midpointTracker.x = (this.player1.x + this.player2.x) / 2;
            this.midpointTracker.y = (this.player1.y + this.player2.y) / 2;
        }

        evaluateCameraState() {
            const distanceX = Math.abs(this.player1.x - this.player2.x);

            if (
                this.cameraState === namespace.CAMERA_STATE.SPLIT &&
                distanceX < namespace.CONFIG.camera_system.merge_state_threshold_px
            ) {
                this.beginMergeTransition();
                return;
            }

            if (
                this.cameraState === namespace.CAMERA_STATE.SHARED &&
                distanceX > namespace.CONFIG.camera_system.split_state_threshold_px
            ) {
                this.beginSplitTransition();
            }
        }

        beginMergeTransition() {
            this.cameraState = namespace.CAMERA_STATE.MERGING;
            this.transitionTweenCount = 0;

            this.mainCamera.stopFollow();
            this.secondaryCamera.stopFollow();
            this.secondaryCamera.setVisible(true);

            const canvasHeight = this.scene.scale.height;
            const midpoint = { x: this.midpointTracker.x, y: this.midpointTracker.y };

            this.tweenCameraRig(
                this.cameraRig.mainViewport,
                { y: 0, height: canvasHeight },
                this.cameraRig.mainFocus,
                midpoint
            );
            this.tweenCameraRig(
                this.cameraRig.secondaryViewport,
                { y: canvasHeight, height: 0 },
                this.cameraRig.secondaryFocus,
                midpoint
            );
        }

        beginSplitTransition() {
            this.cameraState = namespace.CAMERA_STATE.SPLITTING;
            this.transitionTweenCount = 0;

            this.mainCamera.stopFollow();
            this.secondaryCamera.setVisible(true);

            const halfHeight = this.scene.scale.height / 2;
            const player1Focus = { x: this.player1.x, y: this.player1.y };
            const player2Focus = { x: this.player2.x, y: this.player2.y };

            this.tweenCameraRig(
                this.cameraRig.mainViewport,
                { y: 0, height: halfHeight },
                this.cameraRig.mainFocus,
                player1Focus
            );
            this.tweenCameraRig(
                this.cameraRig.secondaryViewport,
                { y: halfHeight, height: halfHeight },
                this.cameraRig.secondaryFocus,
                player2Focus
            );
        }

        tweenCameraRig(viewportState, targetViewport, focusState, targetFocus) {
            const duration = namespace.CONFIG.camera_system.transition_duration_ms;

            this.transitionTweenCount += 2;

            this.scene.tweens.add({
                targets: viewportState,
                y: targetViewport.y,
                height: targetViewport.height,
                duration,
                ease: "Sine.easeInOut",
                onUpdate: () => this.applyViewportState(),
                onComplete: () => this.onTransitionTweenComplete()
            });

            this.scene.tweens.add({
                targets: focusState,
                x: targetFocus.x,
                y: targetFocus.y,
                duration,
                ease: "Sine.easeInOut",
                onUpdate: () => this.applyViewportState(),
                onComplete: () => this.onTransitionTweenComplete()
            });
        }

        onTransitionTweenComplete() {
            this.transitionTweenCount -= 1;
            if (this.transitionTweenCount > 0) {
                return;
            }

            if (this.cameraState === namespace.CAMERA_STATE.MERGING) {
                this.cameraState = namespace.CAMERA_STATE.SHARED;
                this.mainCamera.startFollow(this.midpointTracker, true);
                this.secondaryCamera.stopFollow();
                this.secondaryCamera.setVisible(false);
            } else if (this.cameraState === namespace.CAMERA_STATE.SPLITTING) {
                this.cameraState = namespace.CAMERA_STATE.SPLIT;
                this.secondaryCamera.setVisible(true);
                this.mainCamera.startFollow(this.player1, true);
                this.secondaryCamera.startFollow(this.player2, true);
            }
        }

        applyViewportState() {
            const mainViewport = this.cameraRig.mainViewport;
            const secondaryViewport = this.cameraRig.secondaryViewport;

            this.mainCamera.setViewport(
                mainViewport.x,
                mainViewport.y,
                mainViewport.width,
                Math.max(0, mainViewport.height)
            );
            this.secondaryCamera.setViewport(
                secondaryViewport.x,
                secondaryViewport.y,
                secondaryViewport.width,
                Math.max(0, secondaryViewport.height)
            );

            if (
                this.cameraState === namespace.CAMERA_STATE.MERGING ||
                this.cameraState === namespace.CAMERA_STATE.SPLITTING
            ) {
                this.mainCamera.centerOn(this.cameraRig.mainFocus.x, this.cameraRig.mainFocus.y);
                this.secondaryCamera.centerOn(this.cameraRig.secondaryFocus.x, this.cameraRig.secondaryFocus.y);
            }
        }

        getDebugState() {
            return {
                state: this.cameraState,
                distanceX: Math.abs(this.player1.x - this.player2.x),
                mergeThreshold: namespace.CONFIG.camera_system.merge_state_threshold_px,
                splitThreshold: namespace.CONFIG.camera_system.split_state_threshold_px,
                dividerY: this.cameraRig.secondaryViewport.y
            };
        }
    }

    namespace.CameraController = CameraController;
})(window.RainbowStreet = window.RainbowStreet || {});
