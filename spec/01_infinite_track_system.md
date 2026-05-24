# System Specification: Infinite Track & Obstacles

## 1. Architectural Overview
To support a 5-minute continuous race without breaking memory constraints or hitting the edge of the physics world, the game requires a "Treadmill" or "Chunk-Loading" architecture. Instead of the players moving right indefinitely (which eventually causes floating-point precision issues in physics engines), the *track and obstacles* will move left toward the players, or the camera and track will chunk seamlessly. Given the existing Phaser setup (`CONFIG.world.width_px: 6000`), we will implement a seamless chunk-repositioning system.

## 2. Goals & Requirements
* **Endless Terrain:** The floor must appear continuous for the full 5-minute duration.
* **Procedural Obstacles:** Spawn `cone` and `barrier` obstacles based on the `track_segments` YAML configuration.
* **Object Pooling:** Continuously creating and destroying physics bodies causes garbage collection stutters. We must use Phaser `Physics.Arcade.Group` to recycle off-screen obstacles.
* **Deterministic Spawning:** Both players must face the exact same sequence of obstacles regardless of their relative distance.

## 3. Implementation Steps

### Phase 1: The Floor Treadmill
* [ ] Convert the static `this.floor` rectangle into two identical floor segments (e.g., `floorA` and `floorB`), each `CONFIG.world.width_px` wide.
* [ ] Position `floorA` at `x: 0` and `floorB` at `x: CONFIG.world.width_px`.
* [ ] **Update Loop Logic:** Track the leading player's X coordinate. When the leading player crosses the midpoint of the forward floor segment, snap the trailing floor segment ahead of it.
    * *Example:* If player is on `floorB`, move `floorA` to `floorB.x + width`.

### Phase 2: Obstacle Object Pooling
* [ ] Create two Phaser Object Pools (Groups): `conePool` and `barrierPool`.
* [ ] Pre-allocate ~20 items per pool to prevent mid-race instantiation.
* [ ] Assign collision callbacks between both players and the obstacle groups.

### Phase 3: Segment Generation Logic
* [ ] Create a `TrackManager` class.
* [ ] Implement a weighted random selector using the `selection_weight` from `track_segments` (e.g., `sparse_straightaway`, `heavy_traffic`).
* [ ] As new floor chunks are placed, populate them with obstacles by pulling from the object pools based on the selected segment's `obstacles` array (`x_offset_px`).

## 4. Collision Penalty Application
When a player hits an obstacle:
```javascript
// Example pseudo-code for penalty logic
function handleObstacleCollision(player, obstacle) {
    if (obstacle.active) {
        // Disable obstacle so it only hits once
        obstacle.active = false;

        // Apply speed penalty from config (e.g., 30% reduction)
        const penalty = obstacle.type === 'cone' ? 0.7 : 0.4;
        player.body.velocity.x *= penalty;

        // Optional: Trigger screen shake or particle effect
        playHitEffect(player.x, player.y);
    }
}

```

