// Disable console logs in production hosts
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
}

import PreloadScene from './PreloadScene.js';
import MenuScene from './MenuScene.js';
import CustomizeScene from './CustomizeScene.js';
import LobbyScene from './LobbyScene.js';
import GameScene from './GameScene.js';
import SettingsScene from './SettingsScene.js';
import PlayerData from './PlayerData.js';

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
    const game = new Phaser.Game(config);
    window.game = game;

    // 🚀 Web Worker to keep the game loop ticking at 30 FPS when the tab is running in the background
    try {
        const workerCode = `
            let timer = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (!timer) {
                        timer = setInterval(() => {
                            self.postMessage('tick');
                        }, 33.33); // 30 FPS tick
                    }
                } else if (e.data === 'stop') {
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = function(e) {
            if (e.data === 'tick') {
                if (document.hidden && game && game.isRunning) {
                    const time = performance.now();
                    // Call step manually to update physics and network logic in background tab
                    game.step(time, 33.33);
                }
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                worker.postMessage('start');
            } else {
                worker.postMessage('stop');
            }
        });

        if (document.hidden) {
            worker.postMessage('start');
        }
    } catch (err) {
        console.warn('⚠️ Failed to initialize background execution worker:', err);
    }

    // Set initial graphics quality rendering
    if (PlayerData.graphicsQuality === 'low') {
        game.canvas.style.imageRendering = 'pixelated';
    }
});
