export default class HealthSystem {
    constructor(scene, owner, maxHealth = 100) {
        this.scene = scene;
        this.owner = owner;

        this.max = maxHealth;
        this.current = maxHealth;

        // ❤️ health bar
        this.bar = scene.add.graphics();
    }

    updateBar() {
        const x = this.owner.sprite.x - 30;
        const y = this.owner.sprite.y - 60;

        this.bar.clear();

        // background
        this.bar.fillStyle(0x000000);
        this.bar.fillRect(x, y, 60, 8);

        // health
        this.bar.fillStyle(0xff0000);
        this.bar.fillRect(x, y, 60 * (this.current / this.max), 8);
    }

    takeDamage(amount) {
        this.current -= amount;
        if (this.current < 0) this.current = 0;
    }
}