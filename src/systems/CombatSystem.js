export default class CombatSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
    }

    spawnSlashArc(x, y, dir, color, scaleFactor, baseAlpha, angleOffset, delay = 0) {
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

            graphics.fillStyle(color, baseAlpha);
            graphics.beginPath();
            
            // Forward arc (outer edge)
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const angle = startAngle + t * (endAngle - startAngle);
                const r = radiusInner + (radiusOuter - radiusInner) * Math.sin(t * Math.PI);
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) graphics.moveTo(px, py);
                else graphics.lineTo(px, py);
            }

            // Inner arc (returning edge)
            for (let i = steps; i >= 0; i--) {
                const t = i / steps;
                const angle = startAngle + t * (endAngle - startAngle);
                const px = Math.cos(angle) * radiusInner;
                const py = Math.sin(angle) * radiusInner;
                graphics.lineTo(px, py);
            }

            graphics.closePath();
            graphics.fillPath();

            // Position and orient the slash
            graphics.setPosition(x, y);
            graphics.setRotation(angleOffset * dir);
            
            if (dir === -1) {
                graphics.setScale(-0.25, 0.45); // further reduced height scale to 0.45 (sleeker)
            } else {
                graphics.setScale(0.25, 0.45); // further reduced height scale to 0.45 (sleeker)
            }

            // Rapid sweep animation
            this.scene.tweens.add({
                targets: graphics,
                scaleX: dir * 1.45,
                scaleY: 0.52, // further reduced tween height target to 0.52 (sleeker)
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (graphics && graphics.active) {
                        graphics.destroy();
                    }
                }
            });
        });
    }

    createAttackSlashVisual() {
        const dir = this.player.sprite.flipX ? -1 : 1;
        const x = this.player.sprite.x + dir * 65;
        const y = this.player.sprite.y - 10;
        
        // Define color based on player character
        let color = 0xddffff; // P1 (Knight) - sharp steel/ice blue
        if (this.player.character === 'p2') {
            color = 0xa855f7; // P2 (Shadow) - dark purple
        } else if (this.player.character === 'p3') {
            color = 0xef4444; // P3 (Berserker) - fiery red
        }

        // Spawn Main Slash + 2 trailing tails (with scaling down and tiny delays)
        this.spawnSlashArc(x, y, dir, color, 1.0, 0.85, 0, 0);                 // Main swing
        this.spawnSlashArc(x - dir * 15, y + 5, dir, color, 0.82, 0.5, -0.15, 35); // Tail 1 (35ms delay, smaller, offset rotation)
        this.spawnSlashArc(x - dir * 30, y + 10, dir, color, 0.65, 0.25, -0.3, 70); // Tail 2 (70ms delay, smaller still, further offset)
    }

    attack() {
        this.createAttackSlashVisual();
        const dir = this.player.sprite.flipX ? -1 : 1;

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
                // 🔥 IMPORTANT FIX: skip self
                if (target === this.player) return;
                if (target.sprite === otherGO) {
                    target.takeDamage(this.player.getDamage(), this.player, true);
                }
            });
        });

        this.scene.time.delayedCall(100, () => {
            if (hitbox.active) hitbox.destroy();
        });
    }
}