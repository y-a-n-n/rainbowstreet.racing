(function (namespace) {
    class TrackManager {
        constructor(scene, floorSegments, players) {
            this.scene = scene;
            this.floorSegments = floorSegments;
            this.players = players;
            this.rng = new Phaser.Math.RandomDataGenerator([namespace.CONFIG.track_system.seed]);

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

            for (let index = 0; index < namespace.CONFIG.track_system.pool_size_per_type; index += 1) {
                const obstacle = this.createObstacleInstance(type);
                pool.add(obstacle);
            }

            return pool;
        }

        createObstacleInstance(type) {
            const obstacleConfig = namespace.CONFIG.obstacle_types[type];
            const obstacle =
                type === "cone"
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
            obstacle.triggerZone = this.createObstacleTriggerZone(type);
            obstacle.setActive(false);
            obstacle.setVisible(false);
            obstacle.body.enable = false;

            return obstacle;
        }

        createObstacleTriggerZone(type) {
            const obstacleConfig = namespace.CONFIG.obstacle_types[type];
            const triggerZoneHeight = 160;
            const triggerZoneWidth = obstacleConfig.width_px + 24;
            const triggerZone = this.scene.add.zone(-1000, -1000, triggerZoneWidth, triggerZoneHeight);

            this.scene.physics.add.existing(triggerZone);
            triggerZone.body.setAllowGravity(false);
            triggerZone.body.setImmovable(true);
            triggerZone.body.setSize(triggerZoneWidth, triggerZoneHeight, true);
            triggerZone.setActive(false);
            triggerZone.setVisible(false);
            triggerZone.body.enable = false;
            triggerZone.setData("awardedPlayers", { 1: false, 2: false });

            for (const player of this.players) {
                this.scene.physics.add.overlap(player, triggerZone, this.handleObstacleTriggerOverlap, null, this);
            }

            return triggerZone;
        }

        recycleChunksIfNeeded() {
            const leadingPlayerX = Math.max(...this.players.map((player) => player.x));
            const trailingPlayerX = Math.min(...this.players.map((player) => player.x));

            let didRecycle = true;
            while (didRecycle) {
                didRecycle = false;

                const sortedChunks = [...this.floorSegments].sort(
                    (chunkA, chunkB) => chunkA.getData("chunkStart") - chunkB.getData("chunkStart")
                );
                const rearChunk = sortedChunks[0];
                const frontChunk = sortedChunks[sortedChunks.length - 1];
                const rearChunkEnd = rearChunk.getData("chunkStart") + namespace.CONFIG.world.width_px;
                const recycleThreshold = frontChunk.getData("chunkStart") + (namespace.CONFIG.world.width_px / 2);
                const rearChunkIsBehindAllPlayers =
                    rearChunkEnd < trailingPlayerX - namespace.CONFIG.track_system.recycle_threshold_px;

                if (leadingPlayerX >= recycleThreshold) {
                    const nextChunkStart = frontChunk.getData("chunkStart") + namespace.CONFIG.world.width_px;
                    if (!rearChunkIsBehindAllPlayers) {
                        this.addChunk(nextChunkStart);
                        didRecycle = true;
                        continue;
                    }

                    this.moveChunk(rearChunk, nextChunkStart);
                    didRecycle = true;
                }
            }
        }

        addChunk(nextChunkStart) {
            const chunk = this.scene.createFloorSegment(nextChunkStart);
            this.floorSegments.push(chunk);

            for (const player of this.players) {
                this.scene.physics.add.collider(player, chunk);
            }

            this.populateChunk(chunk);
        }

        moveChunk(chunk, nextChunkStart) {
            chunk.setPosition(nextChunkStart + (namespace.CONFIG.world.width_px / 2), namespace.CONFIG.world.floor_y);
            chunk.setData("chunkStart", nextChunkStart);
            chunk.body.updateFromGameObject();

            this.clearChunkObstacles(chunk);
            this.populateChunk(chunk);
        }

        populateChunk(chunk) {
            const chunkStart = chunk.getData("chunkStart");
            const chunkEnd = chunkStart + namespace.CONFIG.world.width_px;
            let localCursor = 0;
            const chunkObstacles = [];

            while (localCursor < namespace.CONFIG.world.width_px) {
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
            const totalWeight = namespace.CONFIG.track_segments.reduce(
                (sum, segment) => sum + segment.selection_weight,
                0
            );
            let roll = this.rng.frac() * totalWeight;

            for (const segment of namespace.CONFIG.track_segments) {
                roll -= segment.selection_weight;
                if (roll <= 0) {
                    return segment;
                }
            }

            return namespace.CONFIG.track_segments[namespace.CONFIG.track_segments.length - 1];
        }

        acquireObstacle(type) {
            const pool = this.getPool(type);
            const obstacle = pool.getFirstDead(false);
            return obstacle ?? null;
        }

        positionObstacle(obstacle, type, x) {
            const obstacleConfig = namespace.CONFIG.obstacle_types[type];
            const floorTop = namespace.CONFIG.world.floor_y - 40;
            const y = floorTop - (obstacleConfig.height_px / 2);
            const triggerZone = obstacle.triggerZone;
            const triggerZoneY = y - (obstacleConfig.height_px / 2) - (triggerZone.height / 2) - 8;

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

            triggerZone.setPosition(x, triggerZoneY);
            triggerZone.setActive(true);
            triggerZone.body.enable = true;
            triggerZone.setData("awardedPlayers", { 1: false, 2: false });
            triggerZone.body.updateFromGameObject();
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

            if (obstacle.x < trailingPlayerX - namespace.CONFIG.track_system.recycle_threshold_px) {
                this.hideObstacle(obstacle);
            }
        }

        hideObstacle(obstacle) {
            if (obstacle.triggerZone) {
                obstacle.triggerZone.setActive(false);
                obstacle.triggerZone.body.enable = false;
                obstacle.triggerZone.setVisible(false);
                obstacle.triggerZone.body.updateFromGameObject();
            }

            obstacle.setActive(false);
            obstacle.setVisible(false);
            obstacle.body.enable = false;
        }

        handleObstacleTriggerOverlap(player, triggerZone) {
            if (!player.active || !triggerZone.active) {
                return;
            }

            const playerNumber = player.playerNumber ?? (player === this.players[0] ? 1 : 2);
            const awardedPlayers = triggerZone.getData("awardedPlayers") ?? { 1: false, 2: false };
            const obstacle = this.getObstacleForTriggerZone(triggerZone);
            const isGrounded = player.body.blocked.down || player.body.touching.down;

            if (!obstacle || !obstacle.active || awardedPlayers[playerNumber] || isGrounded) {
                return;
            }

            if (Math.abs(player.body.velocity.y) < 1) {
                return;
            }

            if (player.body.bottom > obstacle.body.top + 12) {
                return;
            }

            awardedPlayers[playerNumber] = true;
            triggerZone.setData("awardedPlayers", awardedPlayers);
            this.scene.awardBoostCharge(player);
        }

        getObstacleForTriggerZone(triggerZone) {
            const allObstacles = [...this.conePool.getChildren(), ...this.barrierPool.getChildren()];
            return allObstacles.find((obstacle) => obstacle.triggerZone === triggerZone) ?? null;
        }

        syncWorldBounds() {
            const leadingEdge = Math.max(
                ...this.floorSegments.map((chunk) => chunk.getData("chunkStart") + namespace.CONFIG.world.width_px)
            );
            const worldWidth = leadingEdge + namespace.CONFIG.world.width_px;

            this.scene.physics.world.setBounds(0, 0, worldWidth, namespace.CONFIG.world.height_px);
            this.scene.mainCamera.setBounds(0, 0, worldWidth, namespace.CONFIG.world.height_px);
            this.scene.secondaryCamera.setBounds(0, 0, worldWidth, namespace.CONFIG.world.height_px);
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

    namespace.TrackManager = TrackManager;
})(window.RainbowStreet = window.RainbowStreet || {});
