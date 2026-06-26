export default class CombatSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
    }

    spawnSlashArc(baseOffsetX, baseOffsetY, dir, color, scaleFactor, baseAlpha, angleOffset, delay = 0) {
        this.scene.time.delayedCall(delay, () => {
            if (!this.player || !this.player.sprite || !this.player.sprite.active) return;

            const graphics = this.scene.add.graphics();
            graphics.setDepth(this.player.sprite.depth + 1);

            // Longer and wider crescent swing arc
            const steps = 14;
            const radiusInner = 38 * scaleFactor;
            const radiusOuter = 115 * scaleFactor; // increased from 70 to 115 for extra length/reach
            const startAngle = -Math.PI / 3.0;   // wider angle range
            const endAngle = Math.PI / 3.0;

            const layers = 6;
            const r1 = (color >> 16) & 0xff;
            const g1 = (color >> 8) & 0xff;
            const b1 = color & 0xff;

            for (let j = 0; j < layers; j++) {
                const factor = j / (layers - 1);
                
                // Interpolate color from base character color (factor = 0) to white (factor = 1)
                const r = Math.round(r1 + (255 - r1) * factor);
                const g = Math.round(g1 + (255 - g1) * factor);
                const b = Math.round(b1 + (255 - b1) * factor);
                const col = (r << 16) | (g << 8) | b;

                // Adjust opacity: outer layers are more translucent, inner core is bright and solid
                const alpha = baseAlpha * (0.6 + 0.4 * factor);

                graphics.fillStyle(col, alpha);
                graphics.beginPath();

                // Forward arc (outer edge for this layer)
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const angle = startAngle + t * (endAngle - startAngle);
                    // Thickness scales down from outer edge to inner edge
                    const thickness = (radiusOuter - radiusInner) * Math.sin(t * Math.PI) * (1 - factor);
                    const rCurrent = radiusInner + thickness;
                    const px = Math.cos(angle) * rCurrent;
                    const py = Math.sin(angle) * rCurrent;
                    if (i === 0) graphics.moveTo(px, py);
                    else graphics.lineTo(px, py);
                }

                // Inner arc (returning edge, constant at radiusInner)
                for (let i = steps; i >= 0; i--) {
                    const t = i / steps;
                    const angle = startAngle + t * (endAngle - startAngle);
                    const px = Math.cos(angle) * radiusInner;
                    const py = Math.sin(angle) * radiusInner;
                    graphics.lineTo(px, py);
                }

                graphics.closePath();
                graphics.fillPath();
            }

            // Set initial rotation and scale orientation
            graphics.setRotation(angleOffset * dir);
            
            if (dir === -1) {
                graphics.setScale(-0.25, 0.45);
            } else {
                graphics.setScale(0.25, 0.45);
            }

            // Real-time position tracking to move along with the player
            const updatePos = () => {
                if (graphics && graphics.active && this.player && this.player.sprite && this.player.sprite.active) {
                    const currentDir = this.player.sprite.flipX ? -1 : 1;
                    graphics.setPosition(this.player.sprite.x + currentDir * baseOffsetX, this.player.sprite.y + baseOffsetY);
                    
                    // Keep graphics scale orientation aligned with player direction
                    const absScaleX = Math.abs(graphics.scaleX);
                    graphics.setScale(currentDir * absScaleX, graphics.scaleY);
                }
            };

            // Set initial position
            updatePos();

            // Hook into update event to follow player
            this.scene.events.on('update', updatePos);

            // Rapid sweep animation
            this.scene.tweens.add({
                targets: graphics,
                scaleX: dir * 1.45,
                scaleY: 0.52,
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.scene.events.off('update', updatePos);
                    if (graphics && graphics.active) {
                        graphics.destroy();
                    }
                }
            });
        });
    }

    createAttackSlashVisual() {
        const dir = this.player.sprite.flipX ? -1 : 1;
        
        // Define color based on player character
        let color = 0xddffff; // P1 (Knight) - sharp steel/ice blue
        if (this.player.character === 'p2') {
            color = 0xa855f7; // P2 (Shadow) - dark purple
        } else if (this.player.character === 'p3') {
            color = 0xef4444; // P3 (Berserker) - fiery red
        }

        // Spawn Main Slash + 2 trailing tails (with scaling down and tiny delays)
        // Pass base relative offsets, which get auto-flipped inside updatePos
        this.spawnSlashArc(65, -10, dir, color, 1.0, 0.85, 0, 0);                 // Main swing
        this.spawnSlashArc(50, -5, dir, color, 0.82, 0.5, -0.15, 35); // Tail 1
        this.spawnSlashArc(35, 0, dir, color, 0.65, 0.25, -0.3, 70); // Tail 2
    }

    attack() {
        this.createAttackSlashVisual();
        const dir = this.player.sprite.flipX ? -1 : 1;

        // Create the hitbox at current relative offset
        const hitbox = this.scene.add.rectangle(
            this.player.sprite.x + dir * 80,
            this.player.sprite.y,
            100,
            60
        );
        this.scene.matter.add.gameObject(hitbox, {
            isSensor: true,
            ignoreGravity: true
        });
        hitbox.setFillStyle(0xff0000, 0);

        const targets = this.player.isEnemy
            ? this.scene.players
            : this.scene.enemies;

        hitbox.setOnCollide(pair => {
            const otherBody = pair.bodyA === hitbox.body ? pair.bodyB : pair.bodyA;
            const otherGO = otherBody.gameObject;
            if (!otherGO) return;

            targets.forEach(target => {
                if (target === this.player) return;
                if (target.sprite === otherGO) {
                    target.takeDamage(this.player.getDamage(), this.player, true);
                }
            });
        });

        // Track player position in real-time for the hitbox
        const updateHitboxPos = () => {
            if (hitbox && hitbox.active && this.player && this.player.sprite && this.player.sprite.active) {
                const currentDir = this.player.sprite.flipX ? -1 : 1;
                if (hitbox.body) {
                    this.scene.matter.body.setPosition(hitbox.body, {
                        x: this.player.sprite.x + currentDir * 80,
                        y: this.player.sprite.y
                    });
                } else {
                    hitbox.setPosition(
                        this.player.sprite.x + currentDir * 80,
                        this.player.sprite.y
                    );
                }
            }
        };

        this.scene.events.on('update', updateHitboxPos);

        this.scene.time.delayedCall(100, () => {
            this.scene.events.off('update', updateHitboxPos);
            if (hitbox.active) hitbox.destroy();
        });
    }
}