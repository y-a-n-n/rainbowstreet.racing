Here is the self-contained camera behavior specification. You can hand this directly to your LLM alongside the core game spec to ensure it builds the "Sliding Wipe" architecture instead of hallucinating complex WebGL shaders or jarring hard cuts.

---

## Camera System Specification: The "Sliding Wipe" Architecture

### 1. Architectural Overview

The game utilizes a dynamic, 2-camera viewport manipulation system in Phaser 3. Instead of fading out or crossfading between distinct cameras, the system physically tweens the viewport dimensions and scroll positions of two primary cameras to create a seamless vertical sliding effect when merging or splitting the screen.

### 2. Camera State Machine

The camera manager must operate strictly within one of four states to prevent logic overlap and visual stuttering:

* **`SPLIT`:** Camera 1 focuses on Player 1 (Top). Camera 2 focuses on Player 2 (Bottom).
* **`MERGING`:** Viewports and scroll positions are actively tweening. Input remains active, but state changes are locked.
* **`SHARED`:** Camera 1 expands to fill the screen and follows the midpoint between both players. Camera 2 is collapsed and invisible.
* **`SPLITTING`:** Viewports and scroll positions are actively tweening back to their split configuration.

### 3. Initialization & Setup

* **Camera 1 (Top/Main Camera):** Initialized with `setViewport(0, 0, canvas.width, canvas.height / 2)`. Set to `startFollow(player1)`.
* **Camera 2 (Bottom Camera):** Initialized with `setViewport(0, canvas.height / 2, canvas.width, canvas.height / 2)`. Set to `startFollow(player2)`.
* **Midpoint Tracker:** An invisible, weightless coordinate container (or Phaser Zone) is instantiated. It does not interact with physics.
* **Divider Line (Optional Polish):** A 4px high horizontal graphic is anchored to the top Y-coordinate of Camera 2's viewport to visually separate the screens.

### 4. Update Loop Logic

Every frame, regardless of the camera state, the system calculates the absolute X-axis distance between Player 1 and Player 2 (`distanceX`). The Midpoint Tracker's X and Y coordinates are continuously updated to the exact mathematical center between both players.

### 5. Transition: The Merge Animation

**Trigger:** `cameraState === 'SPLIT'` AND `distanceX < CONFIG.camera_system.merge_state_threshold_px`

1. State changes instantly to `MERGING`.
2. Camera 1 stops following Player 1.
3. Camera 2 stops following Player 2.
4. **Camera 1 Tween:** Tween `height` from its current value to full `canvas.height`. Concurrently tween `scrollX` and `scrollY` to match the Midpoint Tracker's coordinates.
5. **Camera 2 Tween:** Tween `y` (starting position) from `canvas.height / 2` down to `canvas.height` (sliding it off-screen). Tween `height` from `canvas.height / 2` down to `0`.
6. **On Tween Complete:** State changes to `SHARED`. Camera 1 is set to `startFollow(midpointTracker)`.

### 6. Transition: The Split Animation

**Trigger:** `cameraState === 'SHARED'` AND `distanceX > CONFIG.camera_system.split_state_threshold_px`

1. State changes instantly to `SPLITTING`.
2. Camera 1 stops following the Midpoint Tracker.
3. **Camera 1 Tween:** Tween `height` from full `canvas.height` back to `canvas.height / 2`. Concurrently tween `scrollX` and `scrollY` to match Player 1's coordinates.
4. **Camera 2 Tween:** Tween `y` from `canvas.height` back up to `canvas.height / 2`. Tween `height` from `0` back to `canvas.height / 2`. Concurrently tween `scrollX` and `scrollY` to match Player 2's coordinates.
5. **On Tween Complete:** State changes to `SPLIT`. Camera 1 is set to `startFollow(player1)`. Camera 2 is set to `startFollow(player2)`.

### 7. UI / HUD Architecture

Because the main game cameras are dynamically resizing and shifting, no user interface elements (Boost Bars, Distance Trackers, Timers) may be attached to the primary game scene cameras.

* All UI must be rendered in a separate Phaser `Scene` (e.g., `UIScene`).
* The `UIScene` must run in parallel and be layered above the primary game scene.