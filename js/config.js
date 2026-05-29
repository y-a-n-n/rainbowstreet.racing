(function (namespace) {
    const CONFIG = {
        world: {
            gravity_y: 1200,
            width_px: 6000,
            height_px: 720,
            floor_y: 680
        },
        base_movement: {
            acceleration_px_s: 400,
            max_speed_px_s: 800,
            brake_deceleration_px_s: 800,
            friction_ground: 0.9
        },
        jumping: {
            jump_velocity_y_px_s: -700,
            coyote_time_ms: 100
        },
        collision: {
            horizontal_bump_rebound_px_s: 150
        },
        stomp_mechanic: {
            vertical_trigger_overlap_px: 10,
            attacker_rebound_velocity_y_px_s: -500
        },
        track_system: {
            pool_size_per_type: 20,
            recycle_threshold_px: 2400,
            seed: "rainbow-street-track-v1"
        },
        obstacle_types: {
            cone: {
                width_px: 32,
                height_px: 48,
                speed_penalty_percent: 30,
                color: 0xfff04a,
                stroke_color: 0xff5a36
            },
            barrier: {
                width_px: 64,
                height_px: 64,
                speed_penalty_percent: 60,
                color: 0xff355e,
                stroke_color: 0xfff04a
            }
        },
        track_segments: [
            {
                segment_id: "sparse_straightaway",
                selection_weight: 5,
                length_px: 3000,
                obstacles: [
                    { type: "cone", x_offset_px: 800 },
                    { type: "cone", x_offset_px: 2200 }
                ]
            },
            {
                segment_id: "heavy_traffic",
                selection_weight: 2,
                length_px: 4000,
                obstacles: [
                    { type: "barrier", x_offset_px: 1000 },
                    { type: "cone", x_offset_px: 1200 },
                    { type: "barrier", x_offset_px: 2500 }
                ]
            }
        ],
        camera_system: {
            split_state_threshold_px: 800,
            merge_state_threshold_px: 500,
            transition_duration_ms: 300,
            divider_height_px: 4
        }
    };

    const CAMERA_STATE = {
        SPLIT: "SPLIT",
        MERGING: "MERGING",
        SHARED: "SHARED",
        SPLITTING: "SPLITTING"
    };

    namespace.CONFIG = CONFIG;
    namespace.CAMERA_STATE = CAMERA_STATE;
})(window.RainbowStreet = window.RainbowStreet || {});
