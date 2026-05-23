// --- 1. YAML Configuration Mapping ---
const CONFIG = {
    world: {
        gravity_y: 1200
    },
    base_movement: {
        acceleration_px_s: 400,
        max_speed_px_s: 800,
        brake_deceleration_px_s: 800,
        friction_ground: 0.90 // Applied as velocity dampening when no keys are pressed
    },
    jumping: {
        jump_velocity_y_px_s: -700,
        coyote_time_ms: 100
    },
    collision: {
        horizontal_bump_rebound_px_s: 150
    },
    stomp_mechanic: {
        vertical_trigger_overlap_px: 15,
        attacker_rebound_velocity_y_px_s: -500
    }
};

// --- 2. Phaser Game Configuration ---
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: CONFIG.world.gravity_y },
            debug: true // Keep true to see collision boxes
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player1, player2;
let p1Keys, p2Keys;

function preload() {}

function create() {
    // Floor
    const floor = this.add.rectangle(640, 680, 2000, 80, 0x333344);
    this.physics.add.existing(floor, true);

    // Player 1 (Purple - Panda)
    player1 = this.add.rectangle(200, 500, 120, 60, 0x8a2be2);
    this.physics.add.existing(player1);
    setupPlayerPhysics(player1);

    // Player 2 (Orange - Fox)
    player2 = this.add.rectangle(400, 500, 120, 60, 0xff7f50); // Matched size for fairer physics testing
    this.physics.add.existing(player2);
    setupPlayerPhysics(player2);

    // Collisions
    this.physics.add.collider(player1, floor);
    this.physics.add.collider(player2, floor);

    // Player-to-Player Custom Collision Logic
    this.physics.add.collider(player1, player2, handlePlayerCollision, null, this);

    // Inputs
    p1Keys = {
        accel: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        brake: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    };

    p2Keys = {
        accel: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        brake: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    };
}

function update() {
    handleMovement(player1, p1Keys);
    handleMovement(player2, p2Keys);
}

// --- 3. Custom Physics & Movement Functions ---

function setupPlayerPhysics(player) {
    player.body.setCollideWorldBounds(true);
    // Cap horizontal speed, leave vertical uncapped for gravity
    player.body.setMaxVelocity(CONFIG.base_movement.max_speed_px_s, 2000);
}

function handleMovement(player, keys) {
    const isGrounded = player.body.touching.down;

    // Horizontal Movement
    if (keys.accel.isDown) {
        player.body.setAccelerationX(CONFIG.base_movement.acceleration_px_s);
    } else if (keys.brake.isDown) {
        // Apply braking force against current momentum
        if (player.body.velocity.x > 0) {
            player.body.setAccelerationX(-CONFIG.base_movement.brake_deceleration_px_s);
        } else {
            player.body.setAccelerationX(0);
            player.body.setVelocityX(0); // Full stop
        }
    } else {
        // Coasting / Friction
        player.body.setAccelerationX(0);
        if (isGrounded) {
            player.body.setVelocityX(player.body.velocity.x * CONFIG.base_movement.friction_ground);
        }
    }

    // Jumping
    if (keys.jump.isDown && isGrounded) {
        player.body.setVelocityY(CONFIG.jumping.jump_velocity_y_px_s);
    }

    // Boost (Placeholder for the state machine to be added later)
    if (Phaser.Input.Keyboard.JustDown(keys.boost)) {
        console.log("Boost triggered!");
    }
}

function handlePlayerCollision(pA, pB) {
    // Determine relative positioning
    const topPlayer = pA.y < pB.y ? pA : pB;
    const bottomPlayer = pA.y < pB.y ? pB : pA;

    const isFalling = topPlayer.body.velocity.y > 0;
    const overlap = bottomPlayer.body.top - topPlayer.body.bottom;

    // Trigger STOMP if top player is falling and overlapping the top of the bottom player
    if (isFalling && Math.abs(overlap) < CONFIG.stomp_mechanic.vertical_trigger_overlap_px) {

        // 1. Stomper gets upward bounce
        topPlayer.body.setVelocityY(CONFIG.stomp_mechanic.attacker_rebound_velocity_y_px_s);

        // 2. Victim gets a downward shove (Stun state to be added later)
        bottomPlayer.body.setVelocityY(200);
        console.log("STOMP!");

    } else {
        // Horizontal Bump (Push them apart based on spec)
        if (pA.x < pB.x) {
            pA.body.setVelocityX(-CONFIG.collision.horizontal_bump_rebound_px_s);
            pB.body.setVelocityX(CONFIG.collision.horizontal_bump_rebound_px_s);
        } else {
            pA.body.setVelocityX(CONFIG.collision.horizontal_bump_rebound_px_s);
            pB.body.setVelocityX(-CONFIG.collision.horizontal_bump_rebound_px_s);
        }
    }
}