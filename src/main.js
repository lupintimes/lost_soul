import PreloadScene from './PreloadScene.js';
import MenuScene from './MenuScene.js';
import CustomizeScene from './CustomizeScene.js';
import LobbyScene from './LobbyScene.js';
import GameScene from './GameScene.js';
import SettingsScene from './SettingsScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    disableVisibilityChange: true,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1.5 },
            debug: false // set debug to true initially to see slope boundaries
        }
    },
    render: {
        pixelArt: false,
        antialias: true,
        antialiasGL: false,
        roundPixels: false
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [PreloadScene, MenuScene, SettingsScene, CustomizeScene, LobbyScene, GameScene]
};

document.fonts.ready.then(() => {
    window.game = new Phaser.Game(config);
});
