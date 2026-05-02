import GameScene from './GameScene.js';
import MenuScene from './MenuScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: true // turn off later
        }
    },
    scene: [MenuScene,GameScene]
};

new Phaser.Game(config);