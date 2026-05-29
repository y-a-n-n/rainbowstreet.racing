# Boost System And HUD

## Setup

- Run the app locally and open `http://127.0.0.1:8000/`.

## Verification Steps

1. Wait for the match to reach the race state.
2. Confirm both players show 2 filled boost bars in the HUD.
3. Press player 1's boost key and confirm the top row drops to 1 bar.
4. Confirm player 1 visibly accelerates into a boost state.
5. Jump a spawned obstacle cleanly and confirm the matching boost count increases by 1, up to a maximum of 3.

## Expected Result

- Boost charges start at 2 for each player.
- Boost activation consumes exactly one charge and enters `BOOSTING`.
- Obstacle clearance replenishes one charge and never exceeds 3.
- The HUD updates immediately when charges change.
