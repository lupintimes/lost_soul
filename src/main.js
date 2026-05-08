import PreloadScene from './PreloadScene.js';
import MenuScene from './MenuScene.js';
import CustomizeScene from './CustomizeScene.js';
import LobbyScene from './LobbyScene.js';
import GameScene from './GameScene.js';

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
    scene: [PreloadScene, MenuScene, CustomizeScene, LobbyScene, GameScene]
};

new Phaser.Game(config);