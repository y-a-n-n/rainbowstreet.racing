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
    track_system: {
        pool_size_per_type: 20,
        recycle_threshold_px: 2400,
        seed: "rainbow-street-track-v1"
    },
    obstacle_types: {
        cone: {
            width_px: 32,
            height_px: 48,
            speed_penalty_percent: 30,
            color: 0xfff04a,
            stroke_color: 0xff5a36
        },
        barrier: {
            width_px: 64,
            height_px: 64,
            speed_penalty_percent: 60,
            color: 0xff355e,
            stroke_color: 0xfff04a
        }
    },
    track_segments: [
        {
            segment_id: "sparse_straightaway",
            selection_weight: 5,
            length_px: 3000,
            obstacles: [
                { type: "cone", x_offset_px: 800 },
                { type: "cone", x_offset_px: 2200 }
            ]
        },
        {
            segment_id: "heavy_traffic",
            selection_weight: 2,
            length_px: 4000,
            obstacles: [
                { type: "barrier", x_offset_px: 1000 },
                { type: "cone", x_offset_px: 1200 },
                { type: "barrier", x_offset_px: 2500 }
            ]
        }
    ],
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
        this.cameraState = CAMERA_STATE.SHARED;
        this.transitionTweenCount = 0;
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
        handleMovement(this.player1, this.p1Keys);
        handleMovement(this.player2, this.p2Keys);
        this.trackManager.update();

        this.updateMidpointTracker();
        this.evaluateCameraState();
    }

    setupWorld() {
        this.physics.world.setBounds(0, 0, CONFIG.world.width_px * 2, CONFIG.world.height_px);
        this.floorSegments = [
            this.createFloorSegment(0),
            this.createFloorSegment(CONFIG.world.width_px)
        ];
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
            mainViewport: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
            secondaryViewport: { x: 0, y: canvasHeight, width: canvasWidth, height: 0 },
            mainFocus: { x: this.midpointTracker.x, y: this.midpointTracker.y },
            secondaryFocus: { x: this.midpointTracker.x, y: this.midpointTracker.y }
        };

        this.mainCamera = this.cameras.main;
        this.mainCamera.setBounds(0, 0, CONFIG.world.width_px, CONFIG.world.height_px);

        this.secondaryCamera = this.cameras.add(0, halfHeight, canvasWidth, halfHeight);
        this.secondaryCamera.setBounds(0, 0, CONFIG.world.width_px, CONFIG.world.height_px);
        this.secondaryCamera.setVisible(false);

        this.applyViewportState();

        this.mainCamera.startFollow(this.midpointTracker, true);
        this.secondaryCamera.stopFollow();
    }

    setupTrackSystem() {
        this.trackManager = new TrackManager(this, this.floorSegments, [this.player1, this.player2]);
    }

    createFloorSegment(startX) {
        const floor = this.add.rectangle(
            startX + (CONFIG.world.width_px / 2),
            CONFIG.world.floor_y,
            CONFIG.world.width_px,
            80,
            0x333344
        );

        floor.setData("chunkStart", startX);
        floor.setData("chunkWidth", CONFIG.world.width_px);
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
        this.secondaryCamera.setVisible(true);

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
        this.secondaryCamera.setVisible(true);

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
            this.secondaryCamera.setVisible(false);
        } else if (this.cameraState === CAMERA_STATE.SPLITTING) {
            this.cameraState = CAMERA_STATE.SPLIT;
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

class TrackManager {
    constructor(scene, floorSegments, players) {
        this.scene = scene;
        this.floorSegments = floorSegments;
        this.players = players;
        this.rng = new Phaser.Math.RandomDataGenerator([CONFIG.track_system.seed]);

        this.conePool = this.createObstaclePool("cone");
        this.barrierPool = this.createObstaclePool("barrier");

        for (const floorSegment of this.floorSegments) {
            this.populateChunk(floorSegment);
        }

        this.syncWorldBounds();
    }

    update() {
        this.recycleChunksIfNeeded();
        this.recycleOffscreenObstacles();
        this.syncWorldBounds();
    }

    createObstaclePool(type) {
        const pool = this.scene.physics.add.group({
            allowGravity: false,
            immovable: true
        });

        for (let index = 0; index < CONFIG.track_system.pool_size_per_type; index += 1) {
            const obstacle = this.createObstacleInstance(type);
            pool.add(obstacle);
        }

        return pool;
    }

    createObstacleInstance(type) {
        const obstacleConfig = CONFIG.obstacle_types[type];
        const obstacle = type === "cone"
            ? this.scene.add.triangle(
                -1000,
                -1000,
                obstacleConfig.width_px / 2,
                0,
                0,
                obstacleConfig.height_px,
                obstacleConfig.width_px,
                obstacleConfig.height_px,
                obstacleConfig.color
            )
            : this.scene.add.rectangle(
                -1000,
                -1000,
                obstacleConfig.width_px,
                obstacleConfig.height_px,
                obstacleConfig.color
            );

        this.scene.physics.add.existing(obstacle);
        obstacle.setStrokeStyle(4, obstacleConfig.stroke_color);
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
        obstacle.setData("obstacleType", type);
        obstacle.setData("speedPenaltyPercent", obstacleConfig.speed_penalty_percent);
        obstacle.setActive(false);
        obstacle.setVisible(false);
        obstacle.body.enable = false;

        return obstacle;
    }

    recycleChunksIfNeeded() {
        const leadingPlayerX = Math.max(...this.players.map((player) => player.x));

        let didRecycle = true;
        while (didRecycle) {
            didRecycle = false;

            const sortedChunks = [...this.floorSegments].sort(
                (chunkA, chunkB) => chunkA.getData("chunkStart") - chunkB.getData("chunkStart")
            );
            const rearChunk = sortedChunks[0];
            const frontChunk = sortedChunks[sortedChunks.length - 1];
            const recycleThreshold = frontChunk.getData("chunkStart") + (CONFIG.world.width_px / 2);

            if (leadingPlayerX >= recycleThreshold) {
                const nextChunkStart = frontChunk.getData("chunkStart") + CONFIG.world.width_px;
                this.moveChunk(rearChunk, nextChunkStart);
                didRecycle = true;
            }
        }
    }

    moveChunk(chunk, nextChunkStart) {
        chunk.setPosition(nextChunkStart + (CONFIG.world.width_px / 2), CONFIG.world.floor_y);
        chunk.setData("chunkStart", nextChunkStart);
        chunk.body.updateFromGameObject();

        this.clearChunkObstacles(chunk);
        this.populateChunk(chunk);
    }

    populateChunk(chunk) {
        const chunkStart = chunk.getData("chunkStart");
        const chunkEnd = chunkStart + CONFIG.world.width_px;
        let localCursor = 0;
        const chunkObstacles = [];

        while (localCursor < CONFIG.world.width_px) {
            const segment = this.pickWeightedSegment();

            for (const obstacleSpec of segment.obstacles) {
                const spawnX = chunkStart + localCursor + obstacleSpec.x_offset_px;
                if (spawnX >= chunkEnd) {
                    continue;
                }

                const obstacle = this.acquireObstacle(obstacleSpec.type);
                if (!obstacle) {
                    continue;
                }

                this.positionObstacle(obstacle, obstacleSpec.type, spawnX);
                obstacle.setData("chunkStart", chunkStart);
                chunkObstacles.push(obstacle);
            }

            localCursor += segment.length_px;
        }

        chunk.setData("chunkObstacles", chunkObstacles);
    }

    pickWeightedSegment() {
        const totalWeight = CONFIG.track_segments.reduce(
            (sum, segment) => sum + segment.selection_weight,
            0
        );
        let roll = this.rng.frac() * totalWeight;

        for (const segment of CONFIG.track_segments) {
            roll -= segment.selection_weight;
            if (roll <= 0) {
                return segment;
            }
        }

        return CONFIG.track_segments[CONFIG.track_segments.length - 1];
    }

    acquireObstacle(type) {
        const pool = this.getPool(type);
        const obstacle = pool.getFirstDead(false);
        return obstacle ?? null;
    }

    positionObstacle(obstacle, type, x) {
        const obstacleConfig = CONFIG.obstacle_types[type];
        const floorTop = CONFIG.world.floor_y - 40;
        const y = floorTop - (obstacleConfig.height_px / 2);

        obstacle.setPosition(x, y);
        obstacle.setActive(true);
        obstacle.setVisible(true);
        obstacle.body.enable = true;
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
        obstacle.body.setVelocity(0, 0);
        obstacle.body.setSize(obstacleConfig.width_px, obstacleConfig.height_px, true);
        obstacle.body.setOffset(-obstacleConfig.width_px / 2, -obstacleConfig.height_px / 2);
        obstacle.body.updateFromGameObject();
    }

    clearChunkObstacles(chunk) {
        const chunkObstacles = chunk.getData("chunkObstacles") ?? [];
        for (const obstacle of chunkObstacles) {
            this.hideObstacle(obstacle);
        }
    }

    recycleOffscreenObstacles() {
        const trailingPlayerX = Math.min(...this.players.map((player) => player.x));

        this.conePool.children.each((obstacle) => {
            this.recycleObstacleIfBehind(obstacle, trailingPlayerX);
        });
        this.barrierPool.children.each((obstacle) => {
            this.recycleObstacleIfBehind(obstacle, trailingPlayerX);
        });
    }

    recycleObstacleIfBehind(obstacle, trailingPlayerX) {
        if (!obstacle.active) {
            return;
        }

        if (obstacle.x < trailingPlayerX - CONFIG.track_system.recycle_threshold_px) {
            this.hideObstacle(obstacle);
        }
    }

    hideObstacle(obstacle) {
        obstacle.setActive(false);
        obstacle.setVisible(false);
        obstacle.body.enable = false;
    }

    syncWorldBounds() {
        const leadingEdge = Math.max(
            ...this.floorSegments.map((chunk) => chunk.getData("chunkStart") + CONFIG.world.width_px)
        );
        const worldWidth = leadingEdge + CONFIG.world.width_px;

        this.scene.physics.world.setBounds(0, 0, worldWidth, CONFIG.world.height_px);
        this.scene.mainCamera.setBounds(0, 0, worldWidth, CONFIG.world.height_px);
        this.scene.secondaryCamera.setBounds(0, 0, worldWidth, CONFIG.world.height_px);
    }

    getPool(type) {
        return type === "cone" ? this.conePool : this.barrierPool;
    }

    getActiveObstacleSnapshot() {
        return [...this.conePool.getChildren(), ...this.barrierPool.getChildren()]
            .filter((obstacle) => obstacle.active)
            .map((obstacle) => ({
                type: obstacle.getData("obstacleType"),
                x: Math.round(obstacle.x),
                y: Math.round(obstacle.y)
            }))
            .sort((left, right) => left.x - right.x);
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
