# System Specification: The Boost State Machine & UI

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

* [x] Add a `state` property to the player objects (default: `"NORMAL"`).
* [x] Add a `boostCharges` integer property (default: `0` or `1` depending on start conditions).
* [x] Add a `boostTimer` property to track duration.

### Phase 2: Activating Boost

* [x] In `handleMovement`, intercept the `boost` key input.
* [x] **Condition:** If `boostCharges > 0` AND `state !== "BOOSTING"`.
* [x] **Action:** * Subtract 1 from `boostCharges`.
* Set `state = "BOOSTING"`.
* Temporarily override the player's `setMaxVelocity` to `base * speed_multiplier`.
* Set `player.body.velocity.x` instantly to the new max speed.


* [x] **Timer:** Use a `Phaser.Time.TimerEvent` to revert state and max velocity after `duration_ms`.

### Phase 3: Active Regeneration (Jump Clearance)

* [x] Create a vertical "trigger zone" (invisible physics body) above every spawned obstacle.
* [x] If a player's body overlaps this trigger zone while their vertical velocity is negative (moving up) or positive (falling), AND they do not hit the obstacle itself, award 1 Boost Charge.
* [x] Cap the `boostCharges` at `max_bars`.

### Phase 4: UI Integration

* [x] Emit an event from `GameScene` whenever a player's boost charge changes:
  `this.events.emit('boost-changed', { player: 1, charges: 2 });`
* [x] In `UIScene`, listen for this event and update the visual representation (e.g., glowing neon pips/bars at the top and bottom of the screen).

## Implementation Notes

* Players start with 2 boost charges so the mechanic is immediately available in a race.
* Boost state and charge mutation are centralized in `GameScene` to keep UI updates event-driven.
* Trigger zones are attached to recycled obstacle instances so regeneration stays deterministic across pooled obstacles.
* The HUD renders separate boost rows for both players in `UIScene`; player 2 is anchored top-right to keep the racing view clear.
* The boost timer restores `NORMAL` state after `1200ms` without requiring a compile step or any bundling.
  
