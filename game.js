const CONFIG = {
    world: {
        gravity_y: 1200,
        width_px: 6000,
        height_px: 720,
        floor_y: 680
    },
    base_movement: {
        acceleration_px_s: 400,
        max_speed_px_s: 800,
        brake_deceleration_px_s: 800,
        friction_ground: 0.90
    },
    jumping: {
        jump_velocity_y_px_s: -700,
        coyote_time_ms: 100
    },
    collision: {
        horizontal_bump_rebound_px_s: 150
    },
    stomp_mechanic: {
        vertical_trigger_overlap_px: 10,
        attacker_rebound_velocity_y_px_s: -500
    },
    camera_system: {
        split_state_threshold_px: 800,
        merge_state_threshold_px: 500,
        transition_duration_ms: 300,
        divider_height_px: 4
    }
};

const CAMERA_STATE = {
    SPLIT: "SPLIT",
    MERGING: "MERGING",
    SHARED: "SHARED",
    SPLITTING: "SPLITTING"
};

class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this.cameraState = CAMERA_STATE.SPLIT;
        this.transitionTweenCount = 0;
    }

    create() {
        this.setupWorld();
        this.setupPlayers();
        this.setupCollisions();
        this.setupInputs();
        this.setupCameraSystem();

        this.scene.launch("UIScene");
    }

    update() {
        handleMovement(this.player1, this.p1Keys);
        handleMovement(this.player2, this.p2Keys);

        this.updateMidpointTracker();
        this.evaluateCameraState();
    }

    setupWorld() {
        this.physics.world.setBounds(0, 0, CONFIG.world.width_px, CONFIG.world.height_px);

        const groundWidth = CONFIG.world.width_px + 800;
        const floor = this.add.rectangle(
            CONFIG.world.width_px / 2,
            CONFIG.world.floor_y,
            groundWidth,
            80,
            0x333344
        );
        this.physics.add.existing(floor, true);
        this.floor = floor;
    }

    setupPlayers() {
        this.player1 = this.add.rectangle(200, 500, 120, 60, 0x8a2be2);
        this.physics.add.existing(this.player1);
        setupPlayerPhysics(this.player1);

        this.player2 = this.add.rectangle(900, 500, 120, 60, 0xff7f50);
        this.physics.add.existing(this.player2);
        setupPlayerPhysics(this.player2);

        this.midpointTracker = this.add.zone(0, 0, 1, 1);
        this.updateMidpointTracker();
    }

    setupCollisions() {
        this.physics.add.collider(this.player1, this.floor);
        this.physics.add.collider(this.player2, this.floor);
        this.physics.add.collider(this.player1, this.player2, handlePlayerCollision, null, this);
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
        const canvasWidth = this.scale.width;
        const canvasHeight = this.scale.height;
        const halfHeight = canvasHeight / 2;

        this.cameraRig = {
            mainViewport: { x: 0, y: 0, width: canvasWidth, height: halfHeight },
            secondaryViewport: { x: 0, y: halfHeight, width: canvasWidth, height: halfHeight },
            mainFocus: { x: this.player1.x, y: this.player1.y },
            secondaryFocus: { x: this.player2.x, y: this.player2.y }
        };

        this.mainCamera = this.cameras.main;
        this.mainCamera.setBounds(0, 0, CONFIG.world.width_px, CONFIG.world.height_px);

        this.secondaryCamera = this.cameras.add(0, halfHeight, canvasWidth, halfHeight);
        this.secondaryCamera.setBounds(0, 0, CONFIG.world.width_px, CONFIG.world.height_px);

        this.applyViewportState();

        this.mainCamera.startFollow(this.player1, true);
        this.secondaryCamera.startFollow(this.player2, true);
    }

    updateMidpointTracker() {
        this.midpointTracker.x = (this.player1.x + this.player2.x) / 2;
        this.midpointTracker.y = (this.player1.y + this.player2.y) / 2;
    }

    evaluateCameraState() {
        const distanceX = Math.abs(this.player1.x - this.player2.x);

        if (
            this.cameraState === CAMERA_STATE.SPLIT &&
            distanceX < CONFIG.camera_system.merge_state_threshold_px
        ) {
            this.beginMergeTransition();
            return;
        }

        if (
            this.cameraState === CAMERA_STATE.SHARED &&
            distanceX > CONFIG.camera_system.split_state_threshold_px
        ) {
            this.beginSplitTransition();
        }
    }

    beginMergeTransition() {
        this.cameraState = CAMERA_STATE.MERGING;
        this.transitionTweenCount = 0;

        this.mainCamera.stopFollow();
        this.secondaryCamera.stopFollow();

        const canvasHeight = this.scale.height;
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
        this.cameraState = CAMERA_STATE.SPLITTING;
        this.transitionTweenCount = 0;

        this.mainCamera.stopFollow();

        const halfHeight = this.scale.height / 2;
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
        const duration = CONFIG.camera_system.transition_duration_ms;

        this.transitionTweenCount += 2;

        this.tweens.add({
            targets: viewportState,
            y: targetViewport.y,
            height: targetViewport.height,
            duration,
            ease: "Sine.easeInOut",
            onUpdate: () => this.applyViewportState(),
            onComplete: () => this.onTransitionTweenComplete()
        });

        this.tweens.add({
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

        if (this.cameraState === CAMERA_STATE.MERGING) {
            this.cameraState = CAMERA_STATE.SHARED;
            this.mainCamera.startFollow(this.midpointTracker, true);
            this.secondaryCamera.stopFollow();
        } else if (this.cameraState === CAMERA_STATE.SPLITTING) {
            this.cameraState = CAMERA_STATE.SPLIT;
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

        if (this.cameraState === CAMERA_STATE.MERGING || this.cameraState === CAMERA_STATE.SPLITTING) {
            this.mainCamera.centerOn(this.cameraRig.mainFocus.x, this.cameraRig.mainFocus.y);
            this.secondaryCamera.centerOn(this.cameraRig.secondaryFocus.x, this.cameraRig.secondaryFocus.y);
        }
    }

    getCameraDebugState() {
        return {
            state: this.cameraState,
            distanceX: Math.abs(this.player1.x - this.player2.x),
            mergeThreshold: CONFIG.camera_system.merge_state_threshold_px,
            splitThreshold: CONFIG.camera_system.split_state_threshold_px,
            dividerY: this.cameraRig.secondaryViewport.y
        };
    }
}

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
            CONFIG.camera_system.divider_height_px,
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
        this.divider.setDisplaySize(this.scale.width, CONFIG.camera_system.divider_height_px);
        this.divider.setVisible(cameraState.state !== CAMERA_STATE.SHARED);

        this.stateLabel.setText(`Camera: ${cameraState.state}`);
        this.distanceLabel.setText(
            `Distance X: ${Math.round(cameraState.distanceX)} px  Merge < ${cameraState.mergeThreshold}  Split > ${cameraState.splitThreshold}`
        );
    }
}

function setupPlayerPhysics(player) {
    player.body.setCollideWorldBounds(true);
    player.body.setMaxVelocity(CONFIG.base_movement.max_speed_px_s, 2000);
}

function handleMovement(player, keys) {
    const isGrounded = player.body.blocked.down || player.body.touching.down;

    if (keys.accel.isDown) {
        player.body.setAccelerationX(CONFIG.base_movement.acceleration_px_s);
    } else if (keys.brake.isDown) {
        if (player.body.velocity.x > 0) {
            player.body.setAccelerationX(-CONFIG.base_movement.brake_deceleration_px_s);
        } else if (player.body.velocity.x < 0) {
            player.body.setAccelerationX(CONFIG.base_movement.brake_deceleration_px_s);
        } else {
            player.body.setAccelerationX(0);
            player.body.setVelocityX(0);
        }
    } else {
        player.body.setAccelerationX(0);
        if (isGrounded) {
            player.body.setVelocityX(player.body.velocity.x * CONFIG.base_movement.friction_ground);
        }
    }

    if (Phaser.Input.Keyboard.JustDown(keys.jump) && isGrounded) {
        player.body.setVelocityY(CONFIG.jumping.jump_velocity_y_px_s);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.boost)) {
        console.log("Boost triggered!");
    }
}

function handlePlayerCollision(pA, pB) {
    const topPlayer = pA.y < pB.y ? pA : pB;
    const bottomPlayer = pA.y < pB.y ? pB : pA;

    const isFalling = topPlayer.body.velocity.y > 0;
    const overlap = bottomPlayer.body.top - topPlayer.body.bottom;

    if (isFalling && Math.abs(overlap) < CONFIG.stomp_mechanic.vertical_trigger_overlap_px) {
        topPlayer.body.setVelocityY(CONFIG.stomp_mechanic.attacker_rebound_velocity_y_px_s);
        bottomPlayer.body.setVelocityY(200);
        console.log("STOMP!");
        return;
    }

    if (pA.x < pB.x) {
        pA.body.setVelocityX(-CONFIG.collision.horizontal_bump_rebound_px_s);
        pB.body.setVelocityX(CONFIG.collision.horizontal_bump_rebound_px_s);
    } else {
        pA.body.setVelocityX(CONFIG.collision.horizontal_bump_rebound_px_s);
        pB.body.setVelocityX(-CONFIG.collision.horizontal_bump_rebound_px_s);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    backgroundColor: "#1a1a2e",
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: CONFIG.world.gravity_y },
            debug: true
        }
    },
    scene: [GameScene, UIScene]
};

window.__rainbowStreetGame = new Phaser.Game(config);
