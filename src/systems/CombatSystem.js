export default class CombatSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
    }

    attack() {
        const dir = this.player.sprite.flipX ? -1 : 1;

        const hitbox = this.scene.add.rectangle(
            this.player.sprite.x + dir * 40,
            this.player.sprite.y,
            50,
            30,
            0xff0000,
            0.3
        );

        this.scene.physics.add.existing(hitbox);
        hitbox.body.allowGravity = false;

        this.scene.time.delayedCall(100, () => {
            hitbox.destroy();
        });
    }
}