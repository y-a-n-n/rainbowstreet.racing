# System Specification: Catch-Up & Rubber-Banding

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
  