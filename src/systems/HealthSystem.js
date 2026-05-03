export default class HealthSystem {
    constructor(scene, owner, max = 100) {
        this.scene = scene;
        this.owner = owner;

        this.max = max;
        this.current = max;

        this.bar = scene.add.graphics();
    }

    updateBar() {
        if (!this.owner.sprite) return;

        const x = this.owner.sprite.x - 30;
        const y = this.owner.sprite.y - 60;

        this.bar.clear();

        this.bar.fillStyle(0x000000);
        this.bar.fillRect(x, y, 60, 8);

        this.bar.fillStyle(0xff0000);
        this.bar.fillRect(x, y, 60 * (this.current / this.max), 8);
    }
}