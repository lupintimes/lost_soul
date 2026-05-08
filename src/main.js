import GameScene from './GameScene.js';
import MenuScene from './MenuScene.js';
import LobbyScene from './LobbyScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false // turn off later
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [MenuScene,LobbyScene, GameScene]
};

new Phaser.Game(config);