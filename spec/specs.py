
import os

def create_markdown_file(filename, content):
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

spec_1 = """# System Specification: Infinite Track & Obstacles

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

"""

spec_2 = """# System Specification: The Boost State Machine & UI

## 1. Architectural Overview

The Boost system is the primary resource economy of the game. It allows players to break their base maximum speed (`800 px/s`) and reach boosted speeds (`1440 px/s`) for a duration of 1.2 seconds. This requires a dedicated State Machine for the player entity and a decoupled communication pipeline to the `UIScene` to update the HUD.

## 2. Goals & Requirements

* **State Management:** Players must transition cleanly between `NORMAL` and `BOOSTING` states.
* **Resource Tracking:** Each player holds up to 3 discrete Boost Bars.
* **Active Regeneration:** Successfully clearing an obstacle (jumping over it without colliding) awards 1 Boost Bar.
* **UI Updates:** The `UIScene` must reflect the current boost charges for both players in real-time.

## 3. Data Dictionary

Based on `CONFIG.boost_economy`:

* `max_bars`: 3
* `duration_ms`: 1200
* `speed_multiplier`: 1.8

## 4. Implementation Steps

### Phase 1: Player State Machine

* [ ] Add a `state` property to the player objects (default: `"NORMAL"`).
* [ ] Add a `boostCharges` integer property (default: `0` or `1` depending on start conditions).
* [ ] Add a `boostTimer` property to track duration.

### Phase 2: Activating Boost

* [ ] In `handleMovement`, intercept the `boost` key input.
* [ ] **Condition:** If `boostCharges > 0` AND `state !== "BOOSTING"`.
* [ ] **Action:** * Subtract 1 from `boostCharges`.
* Set `state = "BOOSTING"`.
* Temporarily override the player's `setMaxVelocity` to `base * speed_multiplier`.
* Set `player.body.velocity.x` instantly to the new max speed.


* [ ] **Timer:** Use a `Phaser.Time.TimerEvent` to revert state and max velocity after `duration_ms`.

### Phase 3: Active Regeneration (Jump Clearance)

* [ ] Create a vertical "trigger zone" (invisible physics body) above every spawned obstacle.
* [ ] If a player's body overlaps this trigger zone while their vertical velocity is negative (moving up) or positive (falling), AND they do not hit the obstacle itself, award 1 Boost Charge.
* [ ] Cap the `boostCharges` at `max_bars`.

### Phase 4: UI Integration

* [ ] Emit an event from `GameScene` whenever a player's boost charge changes:
  `this.events.emit('boost-changed', { player: 1, charges: 2 });`
* [ ] In `UIScene`, listen for this event and update the visual representation (e.g., glowing neon pips/bars at the top and bottom of the screen).
  """

spec_3 = """# System Specification: Catch-Up & Rubber-Banding

## 1. Architectural Overview

To prevent the 5-minute race from becoming a runaway blowout if one player makes an early mistake, the game utilizes a rubber-banding system. The "Trailing Player" (the player currently furthest to the left) receives both passive resource generation and a subtle, persistent physics buff.

## 2. Goals & Requirements

* **Dynamic Leader Tracking:** The system must continuously evaluate who is in 1st and 2nd place.
* **Passive Regen Timer:** The trailing player receives 1 Boost charge every 15 seconds. This timer pauses or resets if they take the lead.
* **Physics Buff:** The trailing player's base acceleration and maximum speed are increased by 10% to facilitate natural catch-up.

## 3. Data Dictionary

Based on `CONFIG.catch_up_system`:

* `activation_distance_px`: 600
* `trailing_speed_bonus_percent`: 10
* `trailing_accel_bonus_percent`: 10
* `trailing_passive_regen_ms`: 15000

## 4. Implementation Steps

### Phase 1: Leader Evaluation

* [ ] In the `update()` loop of `GameScene`, continuously calculate the X-axis difference: `deltaX = player1.x - player2.x`.
* [ ] Assign internal tags: `leader` and `trailer`.
* [ ] Check if `Math.abs(deltaX) > CONFIG.catch_up_system.activation_distance_px`. If true, activate the catch-up state.

### Phase 2: The Physics Buff

* [ ] Modify the `handleMovement` function to accept a `modifier` parameter.
* [ ] If a player is tagged as the `trailer` and the activation distance is met:
* Apply a 1.1x multiplier to `CONFIG.base_movement.acceleration_px_s`.
* Apply a 1.1x multiplier to `CONFIG.base_movement.max_speed_px_s` (update the `setMaxVelocity` property dynamically).


* [ ] If a player becomes the `leader` or the gap closes below the threshold, immediately revert to base physics values.

### Phase 3: Passive Regeneration Timer

* [ ] Create a custom class or method `TrailingRegenTimer`.
* [ ] This timer ticks down (or up to 15,000ms) ONLY for the player currently tagged as the `trailer`.
* [ ] If the timer hits `15000`, grant the trailer +1 Boost Charge and reset the timer.
* [ ] If the trailer overtakes the leader, pause/reset their regen timer.
* [ ] **UI Hook:** Optionally send the progress of this timer to the `UIScene` to display a subtle loading ring around the trailing player's boost UI.
  """

spec_4 = """# System Specification: The Stomp Stun State

## 1. Architectural Overview

The foundation of the Stomp mechanic is already implemented in `handlePlayerCollision` (the stomper bounces up, the victim is pushed down). However, the critical gameplay penalty—the Stun State—is missing. This state temporarily disables the victim's acceleration inputs and slashes their current speed, solidifying the Stomp as the premier offensive maneuver.

## 2. Goals & Requirements

* **Input Lockout:** The victim cannot accelerate for 400ms.
* **Momentum Penalty:** The victim's horizontal speed is instantly halved.
* **Visual Feedback:** The victim must visually flash or indicate they are stunned so both players understand why the moped is slowing down.

## 3. Data Dictionary

Based on `CONFIG.stomp_mechanic`:

* `victim_stun_duration_ms`: 400
* `victim_speed_penalty_percent`: 50

## 4. Implementation Steps

### Phase 1: Extending the Player State

* [ ] Expand the player state machine to include `"STUNNED"`.
* [ ] Add a `isStunned` boolean flag to the player object (default: `false`).

### Phase 2: Modifying the Collision Callback

* [ ] Inside `handlePlayerCollision`, locate the `if (isFalling && Math.abs(overlap) < ...)` block.
* [ ] Apply the momentum penalty to the `bottomPlayer` (victim):
  `bottomPlayer.body.velocity.x *= (CONFIG.stomp_mechanic.victim_speed_penalty_percent / 100);`
* [ ] Set `bottomPlayer.isStunned = true`.
* [ ] Fire a `Phaser.Time.TimerEvent` to reset `bottomPlayer.isStunned = false` after `CONFIG.stomp_mechanic.victim_stun_duration_ms`.

### Phase 3: Input Interception

* [ ] In `handleMovement`, wrap the acceleration logic:
```javascript
if (keys.accel.isDown && !player.isStunned) {
    player.body.setAccelerationX(CONFIG.base_movement.acceleration_px_s);
} else if (player.isStunned) {
    // Force deceleration/friction during stun
    player.body.setAccelerationX(0);
    player.body.setVelocityX(player.body.velocity.x * CONFIG.base_movement.friction_ground);
}

```



### Phase 4: Visual Polish

* [ ] Add a `Phaser.Tweens.Tween` to the victim during the stun duration to create a visual "damage" flicker (e.g., toggling the `alpha` of the rectangle or tinting it white/red).
* [ ] Play an electrical "ZZZT" particle effect at the point of collision.
  """

spec_5 = """# System Specification: Game Flow & Match Timer

## 1. Architectural Overview

Currently, the game loads directly into an active physics state. A proper competitive arcade game requires a structured lifecycle: Pre-Race (Countdown), Active Racing, and Race Over (Results). Furthermore, the 5-minute win condition needs to be tracked and evaluated.

## 2. Goals & Requirements

* **Lifecycle Management:** Implement strict states to control when players can move.
* **Countdown Sequence:** 3, 2, 1, GO visualization overlay.
* **Perfect Launch:** A strict 150ms timing window around "GO" that rewards players with an immediate speed boost.
* **Match Timer:** A synchronized 5:00 timer that ends the game and declares the player with the highest X-coordinate the winner.

## 3. Data Dictionary

Based on `CONFIG.start_sequence` & Global rules:

* `countdown_seconds`: 3
* `perfect_launch_window_ms`: 150
* `perfect_launch_multiplier`: 1.5
* `match_duration_seconds`: 300 (5 minutes)

## 4. Implementation Steps

### Phase 1: Global Game States

* [ ] Define a global `MATCH_STATE` enum: `WAITING`, `COUNTDOWN`, `RACING`, `FINISHED`.
* [ ] Set default state to `COUNTDOWN` on `Scene.create()`.
* [ ] In `handleMovement`, wrap the entire function in `if (MATCH_STATE !== RACING) return;` so physics inputs are locked initially. (Ensure gravity still applies so they drop onto the grid).

### Phase 2: The Countdown & Perfect Launch

* [ ] Create a UI element in `UIScene` that displays "3", "2", "1", "GO!" at 1000ms intervals.
* [ ] **The Launch Window Tracker:** Create a variable `timeSinceGo` in the `GameScene` update loop.
* [ ] If a player presses `Boost` while `Math.abs(timeSinceGo) < 150ms`:
* Trigger `Perfect Launch`.
* Set their velocity instantly to `CONFIG.base_movement.max_speed_px_s * 1.5`.
* Display a "PERFECT!" UI text pop-up near their moped.


* [ ] If they press it too early (False Start) or too late, ignore or penalize (e.g., slight engine stall visual).

### Phase 3: Match Timer & Win Condition

* [ ] Once state is `RACING`, start a 5-minute countdown timer.
* [ ] Pass the formatted time `MM:SS` to the `UIScene` to display at the top center of the screen.
* [ ] When the timer hits `00:00`:
* Set `MATCH_STATE = FINISHED`.
* Lock inputs and gracefully decelerate mopeds to 0.
* Compare `player1.x` vs `player2.x`.
* Trigger a UI overlay: "PLAYER [X] WINS!"
  """



create_markdown_file("01_infinite_track_system.md", spec_1)
create_markdown_file("02_boost_system_and_ui.md", spec_2)
create_markdown_file("03_rubber_banding_mechanics.md", spec_3)
create_markdown_file("04_stomp_stun_state.md", spec_4)
create_markdown_file("05_game_flow_and_timer.md", spec_5)
