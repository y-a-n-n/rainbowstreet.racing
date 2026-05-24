# System Specification: The Stomp Stun State

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
  