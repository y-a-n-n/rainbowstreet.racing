Here is the complete, unified game specification with the YAML configuration blocks integrated at the bottom. You can use this entire document as the master prompt context for your LLM coding agent.

---

# Game Specification: Neon Moped Madness

## 1. Game Overview

* **Genre:** 2D Side-Scrolling Arcade Racer
* **Architecture:** Browser-based, local-first (HTML5 Canvas or Phaser.js).
* **Visual Style:** Synthwave/Neon night driving with cartoon animal characters (static sprites). Parallax backgrounds.
* **Duration:** 5-minute fixed timer. The winner is the player who covers the most distance when the timer hits zero.

## 2. Camera System (Dynamic Split-to-Shared)

* **Default State:** Horizontal split-screen (Top = Player 1, Bottom = Player 2).
* **Merge Mechanic:** When the horizontal distance (X-axis delta) between Player 1 and Player 2 falls below a specific pixel threshold, the split-screen dissolves into a single, shared, zoomed-out camera view.
* **Split Mechanic:** If the players drift apart beyond the threshold, the camera instantly bisects horizontally back to the top/bottom split view.

## 3. Controls & Inputs

The control scheme is strictly four inputs to ensure accessibility for all skill levels (ideal for sharing a keyboard or using a standard gamepad).

* **Accelerate:** Hold to increase horizontal velocity.
* **Brake:** Hold to decrease horizontal velocity/decelerate.
* **Jump:** Press to apply vertical velocity (leap over obstacles or opponents).
* **Boost:** Press to consume one Boost Bar for a temporary burst of extreme horizontal velocity.

## 4. Player Physics & Bumping Mechanics

* **Physical Properties:** Players exist on the same physical 2D plane and have collision boxes.
* **Horizontal Bumping:** If a trailing player collides with the back of a leading player on the ground, both bounce away slightly (trailing player loses momentum, leading player gets a slight bump forward). Overtaking on the ground is physically impossible.
* **The "Stomp" (Vertical Overtaking):** * To overtake, a player must jump and boost over the opponent.
* If the jumping player lands directly on top of the opponent's collision box, the "Stomp" triggers.
* **Stomp Result:** The stomping player gains an immediate upward vertical bounce (preserving forward momentum). The stomped player suffers a brief "stun" state (momentary loss of top speed or slight downward push).



## 5. Start Sequence & The "Perfect Launch"

* **Grid:** Players start on platforms stacked vertically (Player 1 above Player 2) that merge onto the main track plane after the starting line.
* **Countdown:** Standard 3, 2, 1, GO.
* **Perfect Launch:** If a player hits the **Boost** button at the exact frame "GO" appears, they receive an immediate free speed burst to take the initial lead.

## 6. Boost Economy & Catch-Up Mechanics

* **Boost Capacity:** Maximum of 3 discrete Boost Bars per player.
* **Active Regeneration (Both Players):** Successfully timing a jump to clear randomized track obstacles instantly refills 1 Boost Bar.
* **Passive Regeneration (Trailing Player Only):** The player currently in 2nd place has a passive timer that automatically fills 1 Boost Bar every *X* seconds, ensuring they always have the resources to attempt an overtaking maneuver.
* **Rubber-Banding (Trailing Player Only):** The player in 2nd place receives a persistent flat 10% increase to their base acceleration and top speed until they overtake the leader.

## 7. Environment & Track Design

* **Track Layout:** Endless, procedurally generated flat terrain to support the 5-minute timer.
* **Backgrounds:** 3 distinct biome sets (e.g., Neon City, Cyberpunk Bridge, Outrun Highway). The background utilizes a multi-layer parallax effect to simulate extreme speed.
* **Obstacles:** Randomized static objects (e.g., neon traffic cones, barriers) that trigger collisions (loss of speed) if not jumped over. Obstacles spawn consistently for both players, regardless of camera state.

---

## Configuration Data (YAML DSLs)

### Track & Obstacles

```yaml
global_track_settings:
  biome_types: ["neon_city", "cyberpunk_bridge", "outrun_highway"]
  base_scroll_speed_px_s: 200 # Visual speed of the parallax background

obstacle_types:
  cone:
    width_px: 32
    height_px: 48
    speed_penalty_percent: 30 # How much speed you lose on collision
  barrier:
    width_px: 64
    height_px: 64
    speed_penalty_percent: 60

track_segments:
  - segment_id: "sparse_straightaway"
    selection_weight: 5 # Higher weight = spawns more often
    length_px: 3000
    obstacles:
      - type: "cone"
        x_offset_px: 800 # Distance from the start of the segment
      - type: "cone"
        x_offset_px: 2200

  - segment_id: "heavy_traffic"
    selection_weight: 2
    length_px: 4000
    obstacles:
      - type: "barrier"
        x_offset_px: 1000
      - type: "cone"
        x_offset_px: 1200
      - type: "barrier"
        x_offset_px: 2500

```

### Player Movement & Physics

```yaml
world:
  gravity_y: 1200 # High gravity makes jumps feel snappy and arcade-like

base_movement:
  acceleration_px_s: 400
  max_speed_px_s: 800
  brake_deceleration_px_s: 800
  friction_ground: 0.90 # Drag applied when no buttons are pressed

jumping:
  jump_velocity_y_px_s: -700
  coyote_time_ms: 100 # Grace period to jump after falling off a ledge

collision:
  horizontal_bump_rebound_px_s: 150 # How far players bounce apart when touching

```

### Core Mechanics

```yaml
start_sequence:
  countdown_seconds: 3
  perfect_launch_window_ms: 150 # Window before/after "GO" to get the boost
  perfect_launch_multiplier: 1.5 # 50% speed boost off the line

boost_economy:
  max_bars: 3
  duration_ms: 1200 # How long a boost lasts
  speed_multiplier: 1.8 
  
  # Regeneration rules
  jump_clearance_reward: 1 # Bars awarded for jumping an obstacle
  trailing_passive_regen_ms: 15000 # Trailing player gets 1 bar every 15 seconds

stomp_mechanic:
  vertical_trigger_overlap_px: 10 # How deep the collision needs to be to count as a stomp
  attacker_rebound_velocity_y_px_s: -500 # The upward bounce the stomper gets
  victim_stun_duration_ms: 400 # How long the stomped player loses inputs
  victim_speed_penalty_percent: 50 # Speed reduction during stun

catch_up_system:
  activation_distance_px: 600 # Gap required before rubber-banding kicks in
  trailing_speed_bonus_percent: 10
  trailing_accel_bonus_percent: 10

camera_system:
  split_state_threshold_px: 800 # Distance before the screen splits
  merge_state_threshold_px: 500 # Distance before the screen merges back
  transition_duration_ms: 300 # Smooth pan time between split and shared

```