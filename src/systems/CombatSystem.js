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
            60,
            0xff0000,
            0.3
        );

        this.scene.physics.add.existing(hitbox);
        hitbox.body.allowGravity = false;

        const targets = this.player.isEnemy
            ? this.scene.players
            : this.scene.enemies;

        targets.forEach(target => {

            // 🔥 IMPORTANT FIX: skip self
            if (target === this.player) return;

            this.scene.physics.add.overlap(hitbox, target.sprite, () => {
                target.takeDamage(10);
            });
        });

        this.scene.time.delayedCall(100, () => hitbox.destroy());
    }
}