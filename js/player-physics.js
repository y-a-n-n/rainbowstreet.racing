(function (namespace) {
    function setupPlayerPhysics(player) {
        player.body.setCollideWorldBounds(true);
        player.body.setMaxVelocity(namespace.CONFIG.base_movement.max_speed_px_s, 2000);
    }

    function initializeBoostState(player, startingCharges) {
        player.state = "NORMAL";
        player.boostCharges = startingCharges;
        player.boostTimer = null;
    }

    function tryActivateBoost(player) {
        if (!player.scene || typeof player.scene.startPlayerBoost !== "function") {
            return false;
        }

        return player.scene.startPlayerBoost(player);
    }

    function normalizeMovementModifier(modifier) {
        if (typeof modifier === "number") {
            return {
                accelerationModifier: modifier,
                speedModifier: modifier
            };
        }

        return {
            accelerationModifier: modifier?.accelerationModifier ?? 1,
            speedModifier: modifier?.speedModifier ?? 1
        };
    }

    function handleMovement(player, keys, modifier = 1, matchState = namespace.MATCH_STATE.RACING) {
        const isGrounded = player.body.blocked.down || player.body.touching.down;

        if (matchState !== namespace.MATCH_STATE.RACING) {
            player.body.setAccelerationX(0);

            if (matchState === namespace.MATCH_STATE.FINISHED && isGrounded) {
                player.body.setVelocityX(player.body.velocity.x * namespace.CONFIG.base_movement.friction_ground);
                if (Math.abs(player.body.velocity.x) < 5) {
                    player.body.setVelocityX(0);
                }
            }

            return;
        }

        const boostActivated = Phaser.Input.Keyboard.JustDown(keys.boost) && tryActivateBoost(player);
        const boostMultiplier = player.state === "BOOSTING" ? namespace.CONFIG.boost_economy.speed_multiplier : 1;
        const movementModifier = normalizeMovementModifier(modifier);
        const acceleration =
            namespace.CONFIG.base_movement.acceleration_px_s * movementModifier.accelerationModifier * boostMultiplier;
        const maxSpeed = namespace.CONFIG.base_movement.max_speed_px_s * movementModifier.speedModifier * boostMultiplier;

        player.body.setMaxVelocity(maxSpeed, 2000);

        if (boostActivated) {
            player.body.setVelocityX(maxSpeed);
        }

        if (keys.accel.isDown) {
            player.body.setAccelerationX(acceleration);
        } else if (keys.brake.isDown) {
            if (player.body.velocity.x > 0) {
                player.body.setAccelerationX(-namespace.CONFIG.base_movement.brake_deceleration_px_s);
            } else if (player.body.velocity.x < 0) {
                player.body.setAccelerationX(namespace.CONFIG.base_movement.brake_deceleration_px_s);
            } else {
                player.body.setAccelerationX(0);
                player.body.setVelocityX(0);
            }
        } else {
            player.body.setAccelerationX(0);
            if (isGrounded && !boostActivated && player.state !== "BOOSTING") {
                player.body.setVelocityX(player.body.velocity.x * namespace.CONFIG.base_movement.friction_ground);
            }
        }

        if (Phaser.Input.Keyboard.JustDown(keys.jump) && isGrounded) {
            player.body.setVelocityY(namespace.CONFIG.jumping.jump_velocity_y_px_s);
        }
    }

    function handlePlayerCollision(pA, pB) {
        if (pA.scene && typeof pA.scene.showBonkPopup === "function") {
            pA.scene.showBonkPopup(pA);
        }
        if (pB.scene && typeof pB.scene.showBonkPopup === "function") {
            pB.scene.showBonkPopup(pB);
        }

        const topPlayer = pA.y < pB.y ? pA : pB;
        const bottomPlayer = pA.y < pB.y ? pB : pA;
        const isFalling = topPlayer.body.velocity.y > 0;
        const overlap = bottomPlayer.body.top - topPlayer.body.bottom;

        if (isFalling && Math.abs(overlap) < namespace.CONFIG.stomp_mechanic.vertical_trigger_overlap_px) {
            topPlayer.body.setVelocityY(namespace.CONFIG.stomp_mechanic.attacker_rebound_velocity_y_px_s);
            bottomPlayer.body.setVelocityY(200);
            console.log("STOMP!");
            return;
        }

        if (pA.x < pB.x) {
            pA.body.setVelocityX(-namespace.CONFIG.collision.horizontal_bump_rebound_px_s);
            pB.body.setVelocityX(namespace.CONFIG.collision.horizontal_bump_rebound_px_s);
        } else {
            pA.body.setVelocityX(namespace.CONFIG.collision.horizontal_bump_rebound_px_s);
            pB.body.setVelocityX(-namespace.CONFIG.collision.horizontal_bump_rebound_px_s);
        }
    }

    namespace.setupPlayerPhysics = setupPlayerPhysics;
    namespace.initializeBoostState = initializeBoostState;
    namespace.handleMovement = handleMovement;
    namespace.handlePlayerCollision = handlePlayerCollision;
    namespace.tryActivateBoost = tryActivateBoost;
})(window.RainbowStreet = window.RainbowStreet || {});
