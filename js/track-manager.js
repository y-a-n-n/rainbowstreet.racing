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
                const recycleThreshold = frontChunk.getData("chunkStart") + (namespace.CONFIG.world.width_px / 2);

                if (leadingPlayerX >= recycleThreshold) {
                    const nextChunkStart = frontChunk.getData("chunkStart") + namespace.CONFIG.world.width_px;
                    this.moveChunk(rearChunk, nextChunkStart);
                    didRecycle = true;
                }
            }
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

            if (obstacle.x < trailingPlayerX - namespace.CONFIG.track_system.recycle_threshold_px) {
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
