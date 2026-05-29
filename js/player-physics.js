(function (namespace) {
    function setupPlayerPhysics(player) {
        player.body.setCollideWorldBounds(true);
        player.body.setMaxVelocity(namespace.CONFIG.base_movement.max_speed_px_s, 2000);
    }

    function handleMovement(player, keys, modifier = 1) {
        const acceleration = namespace.CONFIG.base_movement.acceleration_px_s * modifier;
        const maxSpeed = namespace.CONFIG.base_movement.max_speed_px_s * modifier;
        const isGrounded = player.body.blocked.down || player.body.touching.down;

        player.body.setMaxVelocity(maxSpeed, 2000);

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
            if (isGrounded) {
                player.body.setVelocityX(player.body.velocity.x * namespace.CONFIG.base_movement.friction_ground);
            }
        }

        if (Phaser.Input.Keyboard.JustDown(keys.jump) && isGrounded) {
            player.body.setVelocityY(namespace.CONFIG.jumping.jump_velocity_y_px_s);
        }

        if (Phaser.Input.Keyboard.JustDown(keys.boost)) {
            console.log("Boost triggered!");
        }
    }

    function handlePlayerCollision(pA, pB) {
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
    namespace.handleMovement = handleMovement;
    namespace.handlePlayerCollision = handlePlayerCollision;
})(window.RainbowStreet = window.RainbowStreet || {});
