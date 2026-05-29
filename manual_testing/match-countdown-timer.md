# Match Countdown And Timer

## Setup

- Run the app locally and open `http://127.0.0.1:8000/`.

## Verification Steps

1. Load the page and wait for the overlay to appear.
2. Confirm the HUD shows `3`, then `2`, then `1`, then `GO!`.
3. Confirm the match timer is visible at the top center during the countdown.
4. After `GO!`, confirm the countdown text disappears and the race timer continues counting down.
5. Try pressing movement keys before `GO!` and confirm the players do not accelerate.

## Expected Result

- Countdown text is visible during the pre-race phase.
- Match timer is visible and formatted as `MM:SS`.
- Player input is locked until the race begins.
