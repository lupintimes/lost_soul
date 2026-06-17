export default class CombatSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
    }

    attack() {
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
                    target.takeDamage(this.player.getDamage(), this.player);
                }
            });
        });

        this.scene.time.delayedCall(100, () => {
            if (hitbox.active) hitbox.destroy();
        });
    }
}