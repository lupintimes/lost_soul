export default class HealthSystem {
    constructor(scene, owner, max = 100) {
        this.scene = scene;
        this.owner = owner;

        this.max = max;
        this.current = max;
        this.visualHealth = max; // Animated catch-up health tracker

        this.bar = scene.add.graphics();
    }

    updateBar() {
        if (!this.owner.sprite) return;

        const width = 60;
        const height = 8;
        const radius = 3; // Rounded corner radius
        const x = this.owner.sprite.x - width / 2;
        const y = this.owner.sprite.y - 60;

        this.bar.clear();
        this.bar.setDepth(this.owner.sprite.depth + 1);

        // Update visual catch-up tracker (slowly lerps down to meet current health)
        if (this.visualHealth > this.current) {
            this.visualHealth = Phaser.Math.Linear(this.visualHealth, this.current, 0.08);
            if (this.visualHealth - this.current < 0.5) {
                this.visualHealth = this.current;
            }
        } else if (this.visualHealth < this.current) {
            // Immediately jump visual health up if healed
            this.visualHealth = this.current;
        }

        const pct = Math.max(0, Math.min(1, this.current / this.max));
        const visualPct = Math.max(0, Math.min(1, this.visualHealth / this.max));

        // 1. Draw outer black border outline (thick rounded shadow)
        this.bar.fillStyle(0x000000, 0.85);
        this.bar.fillRoundedRect(x - 2, y - 2, width + 4, height + 4, radius + 1);

        // 2. Draw dark background backing
        this.bar.fillStyle(0x1a0505, 0.95);
        this.bar.fillRoundedRect(x, y, width, height, radius);

        // 3. Draw visual catch-up bar (bright orange-red chunk left behind on damage)
        if (visualPct > 0) {
            this.bar.fillStyle(0xff5533, 1);
            this.bar.fillRoundedRect(x, y, width * visualPct, height, radius);
        }

        // 4. Draw current health bar fill (smoothly interpolated color)
        if (pct > 0) {
            // Dynamic color interpolation: Red (231, 76, 60) -> Yellow (241, 196, 15) -> Green (46, 204, 113)
            let r, g, b;
            if (pct < 0.5) {
                // Red to Yellow
                const ratio = pct * 2;
                r = Math.round(231 + (241 - 231) * ratio);
                g = Math.round(76 + (196 - 76) * ratio);
                b = Math.round(60 + (15 - 60) * ratio);
            } else {
                // Yellow to Green
                const ratio = (pct - 0.5) * 2;
                r = Math.round(241 + (46 - 241) * ratio);
                g = Math.round(196 + (204 - 196) * ratio);
                b = Math.round(15 + (113 - 15) * ratio);
            }
            const color = (r << 16) + (g << 8) + b;

            this.bar.fillStyle(color, 1);
            this.bar.fillRoundedRect(x, y, width * pct, height, radius);

            // 5. Add a subtle highlight/gloss overlay on the top half
            this.bar.fillStyle(0xffffff, 0.2);
            this.bar.fillRoundedRect(x, y, width * pct, height / 2, { tl: radius, tr: radius, bl: 0, br: 0 });
        }

        // 6. Draw clean border outline around the bar
        this.bar.lineStyle(1.5, 0xffffff, 0.25);
        this.bar.strokeRoundedRect(x, y, width, height, radius);
    }
}