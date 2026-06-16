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

        const width = 60;
        const height = 8;
        const x = this.owner.sprite.x - width / 2;
        const y = this.owner.sprite.y - 60;

        this.bar.clear();
        this.bar.setDepth(this.owner.sprite.depth + 1);

        // 1. Draw outer border/shadow
        this.bar.fillStyle(0x000000, 0.7);
        this.bar.fillRect(x - 2, y - 2, width + 4, height + 4);

        // 2. Draw dark red backing (representing max health)
        this.bar.fillStyle(0x3a0000, 1);
        this.bar.fillRect(x, y, width, height);

        // 3. Determine color based on health percentage
        const pct = Math.max(0, Math.min(1, this.current / this.max));
        let color = 0x2ecc71; // Green
        if (pct < 0.3) {
            color = 0xe74c3c; // Red
        } else if (pct < 0.6) {
            color = 0xf1c40f; // Yellow
        }

        // 4. Draw current health fill
        if (pct > 0) {
            this.bar.fillStyle(color, 1);
            this.bar.fillRect(x, y, width * pct, height);

            // 5. Add a subtle highlight/gloss overlay on the top half
            this.bar.fillStyle(0xffffff, 0.25);
            this.bar.fillRect(x, y, width * pct, height / 2);
        }
    }
}