export default class HealthSystem {
    constructor(maxHealth = 100) {
        this.max = maxHealth;
        this.current = maxHealth;
    }

    takeDamage(amount) {
        this.current -= amount;

        if (this.current <= 0) {
            this.current = 0;
            console.log("Player Dead");
        }
    }
}