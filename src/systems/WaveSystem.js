export default class WaveSystem {
    constructor(scene) {
        this.scene = scene;
        this.currentWave = 0;
        this.state = 'waiting'; // 'waiting', 'active'
        this.countdown = 5; // seconds before first wave
        this.totalEnemiesInWave = 0;
        this.enemiesDefeatedInWave = 0;
        
        // Spawn timer
        this.countdownTimer = null;
    }

    start() {
        this.startCountdown(5);
    }

    startCountdown(seconds) {
        this.state = 'waiting';
        this.countdown = seconds;
        
        if (this.countdownTimer) {
            this.countdownTimer.remove();
        }

        this.countdownTimer = this.scene.time.addEvent({
            delay: 1000,
            callback: () => {
                this.countdown--;
                if (this.countdown <= 0) {
                    this.countdownTimer.remove();
                    this.countdownTimer = null;
                    this.startNextWave();
                } else {
                    // Update countdown display
                    if (this.scene.updateWaveHUD) {
                        this.scene.updateWaveHUD();
                    }
                }
            },
            callbackScope: this,
            loop: true
        });

        if (this.scene.updateWaveHUD) {
            this.scene.updateWaveHUD();
        }
    }

    startNextWave() {
        this.currentWave++;
        this.state = 'active';
        this.enemiesDefeatedInWave = 0;

        // Calculate wave difficulty parameters
        // Wave 1: 3 enemies, Wave 2: 5 enemies, Wave 3: 6 enemies, Wave 4: 8 enemies, etc.
        this.totalEnemiesInWave = Math.round(2 + this.currentWave * 1.5);
        
        // Scale enemy stats
        const hpMultiplier = 1 + (this.currentWave - 1) * 0.15;
        const speedMultiplier = Math.min(1.5, 1 + (this.currentWave - 1) * 0.05);

        // Notify client GameScene to announce the wave
        if (this.scene.announceWave) {
            this.scene.announceWave(this.currentWave);
        }

        // Spawn enemies
        if (this.scene.spawnWaveEnemies) {
            this.scene.spawnWaveEnemies(this.totalEnemiesInWave, hpMultiplier, speedMultiplier);
        }

        if (this.scene.updateWaveHUD) {
            this.scene.updateWaveHUD();
        }
    }

    onEnemyDefeated() {
        if (this.state !== 'active') return;

        this.enemiesDefeatedInWave++;

        if (this.scene.updateWaveHUD) {
            this.scene.updateWaveHUD();
        }

        if (this.enemiesDefeatedInWave >= this.totalEnemiesInWave) {
            // Wave complete!
            if (this.scene.announceWaveComplete) {
                this.scene.announceWaveComplete(this.currentWave);
            }
            // Start countdown for next wave (8 seconds break)
            this.startCountdown(8);
        }
    }

    destroy() {
        if (this.countdownTimer) {
            this.countdownTimer.remove();
            this.countdownTimer = null;
        }
    }
}
