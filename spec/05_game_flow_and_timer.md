# System Specification: Game Flow & Match Timer

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
  