import PlayerData from './PlayerData.js';

export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super('SettingsScene');
    }

    init(data) {
        this.fromScene = data ? data.fromScene : null;
    }

    playClick() {
        try {
            if (this.sound.context && this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }
            if (this.cache.audio.exists('sfx_click')) {
                this.sound.play('sfx_click', { volume: 0.3 * PlayerData.sfxVolume });
            }
        } catch (e) {
            // ignore
        }
    }

    create() {
        this.cameras.main.setRoundPixels(false);
        const { width, height } = this.scale;

        // ─── Background ───────────────────────────────────
        if (this.fromScene !== 'GameScene') {
            this.add.image(0, 0, 'menu_bg')
                .setOrigin(0)
                .setDisplaySize(width, height);
            this.add.rectangle(0, 0, width, height, 0x090a0b, 0.75).setOrigin(0);
        } else {
            // Semi-transparent backdrop for overlay on top of active game
            this.add.rectangle(0, 0, width, height, 0x090a0b, 0.6).setOrigin(0);
        }

        // ─── ESC Key Listener ─────────────────────────────
        this.input.keyboard.on('keydown-ESC', () => {
            this.playClick();
            if (this.fromScene === 'GameScene') {
                this.scene.stop('SettingsScene');
            } else {
                this.scene.start('MenuScene');
            }
        });

        // ─── Title ────────────────────────────────────────
        this.add.text(width / 2, 50, 'SETTINGS', {
            fontFamily: 'Rajdhani',
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ─── Back Button ──────────────────────────────────
        const backBtnContainer = this.add.container(20, 20);
        const backW = 100;
        const backH = 40;
        const backBg = this.add.graphics();
        const drawBackBg = (color, alpha, borderColor) => {
            backBg.clear();
            backBg.fillStyle(color, alpha);
            backBg.fillRoundedRect(0, 0, backW, backH, 6);
            backBg.lineStyle(1.5, borderColor, 0.8);
            backBg.strokeRoundedRect(0, 0, backW, backH, 6);
        };
        drawBackBg(0x0d121d, 0.7, 0x2e3d52);
        backBtnContainer.add(backBg);

        const backText = this.add.text(backW / 2, backH / 2, '← BACK', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        backBtnContainer.add(backText);

        backBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, backW, backH), Phaser.Geom.Rectangle.Contains);
        backBtnContainer.on('pointerover', () => {
            drawBackBg(0x17212e, 0.85, 0xff4444);
            backText.setColor('#ffffff');
        });
        backBtnContainer.on('pointerout', () => {
            drawBackBg(0x0d121d, 0.7, 0x2e3d52);
            backText.setColor('#7fa3c7');
        });
        backBtnContainer.on('pointerdown', () => {
            this.playClick();
            if (this.fromScene === 'GameScene') {
                this.scene.stop('SettingsScene');
            } else {
                this.scene.start('MenuScene');
            }
        });

        // ─── Settings Panel ──────────────────────────────
        const panelW = 500;
        const hasLeaveBtn = this.fromScene === 'GameScene';
        const panelH = hasLeaveBtn ? 440 : 400;
        const panelX = width / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2 + (hasLeaveBtn ? 10 : 30);

        const panelG = this.add.graphics();
        panelG.fillStyle(0x0d121d, 0.85);
        panelG.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
        panelG.lineStyle(1.5, 0x2e3d52, 1);
        panelG.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

        // ─── Music Control Slider ─────────────────────────
        const musicY = panelY + 90;
        this.createSlider(width / 2, musicY, 'MUSIC VOLUME', 
            () => PlayerData.musicVolume, 
            (val) => PlayerData.setMusicVolume(val)
        );

        // ─── SFX Control Slider ───────────────────────────
        const sfxY = panelY + 200;
        this.createSlider(width / 2, sfxY, 'SFX VOLUME', 
            () => PlayerData.sfxVolume, 
            (val) => PlayerData.setSfxVolume(val)
        );

        // ─── Graphics Quality Control ─────────────────────
        const graphicsY = panelY + 310;
        this.add.text(width / 2, graphicsY - 42, 'GRAPHICS QUALITY', {
            fontFamily: 'Rajdhani',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        const btnW = 100;
        const btnH = 35;

        // Low Quality Button
        const lowContainer = this.add.container(width / 2 - 60 - btnW / 2, graphicsY - btnH / 2);
        const lowBg = this.add.graphics();
        const lowText = this.add.text(btnW / 2, btnH / 2, 'LOW', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        lowContainer.add(lowBg);
        lowContainer.add(lowText);

        // High Quality Button
        const highContainer = this.add.container(width / 2 + 60 - btnW / 2, graphicsY - btnH / 2);
        const highBg = this.add.graphics();
        const highText = this.add.text(btnW / 2, btnH / 2, 'HIGH', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        highContainer.add(highBg);
        highContainer.add(highText);

        const drawQualityButtons = () => {
            const isLow = PlayerData.graphicsQuality === 'low';
            
            // Draw Low
            lowBg.clear();
            lowBg.fillStyle(isLow ? 0x17212e : 0x0d121d, 0.85);
            lowBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            lowBg.lineStyle(1.5, isLow ? 0x7dd3fc : 0x2e3d52, 0.9);
            lowBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            lowText.setColor(isLow ? '#ffffff' : '#7fa3c7');

            // Draw High
            highBg.clear();
            highBg.fillStyle(!isLow ? 0x17212e : 0x0d121d, 0.85);
            highBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            highBg.lineStyle(1.5, !isLow ? 0x7dd3fc : 0x2e3d52, 0.9);
            highBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            highText.setColor(!isLow ? '#ffffff' : '#7fa3c7');
        };

        drawQualityButtons();

        lowContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        lowContainer.on('pointerover', () => {
            if (PlayerData.graphicsQuality !== 'low') {
                lowBg.lineStyle(1.5, 0xffffff, 0.5);
                lowBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            }
        });
        lowContainer.on('pointerout', () => drawQualityButtons());
        lowContainer.on('pointerdown', () => {
            PlayerData.setGraphicsQuality('low');
            this.game.canvas.style.imageRendering = 'pixelated';
            drawQualityButtons();
            this.playClick();
        });

        highContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        highContainer.on('pointerover', () => {
            if (PlayerData.graphicsQuality === 'low') {
                highBg.lineStyle(1.5, 0xffffff, 0.5);
                highBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            }
        });
        highContainer.on('pointerout', () => drawQualityButtons());
        highContainer.on('pointerdown', () => {
            PlayerData.setGraphicsQuality('high');
            this.game.canvas.style.imageRendering = 'auto';
            drawQualityButtons();
            this.playClick();
        });

        // ─── Leave Game Button ─────────────────────────────
        if (hasLeaveBtn) {
            const leaveY = panelY + 395;
            const leaveBtn = this.add.container(width / 2 - 100, leaveY - 17);
            const lW = 200;
            const lH = 35;
            
            const leaveBg = this.add.graphics();
            const drawLeaveBg = (color, alpha, borderColor) => {
                leaveBg.clear();
                leaveBg.fillStyle(color, alpha);
                leaveBg.fillRoundedRect(0, 0, lW, lH, 6);
                leaveBg.lineStyle(1.5, borderColor, 0.8);
                leaveBg.strokeRoundedRect(0, 0, lW, lH, 6);
            };
            drawLeaveBg(0x3f1a1a, 0.7, 0x882222);
            leaveBtn.add(leaveBg);

            const leaveText = this.add.text(lW / 2, lH / 2, 'LEAVE GAME', {
                fontFamily: 'Rajdhani',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#ff8888'
            }).setOrigin(0.5);
            leaveBtn.add(leaveText);

            leaveBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, lW, lH), Phaser.Geom.Rectangle.Contains);
            leaveBtn.on('pointerover', () => {
                drawLeaveBg(0x5a1f1f, 0.9, 0xff4444);
                leaveText.setColor('#ffffff');
            });
            leaveBtn.on('pointerout', () => {
                drawLeaveBg(0x3f1a1a, 0.7, 0x882222);
                leaveText.setColor('#ff8888');
            });
            leaveBtn.on('pointerdown', () => {
                this.playClick();
                this.scene.stop('SettingsScene');
                const gameScene = this.scene.get(this.fromScene);
                if (gameScene) {
                    if (gameScene.mode === 'multiplayer') {
                        gameScene.leaveMultiplayer();
                    } else {
                        gameScene.cleanupChat();
                        gameScene.cleanupDOMUI();
                        gameScene.scene.start('MenuScene');
                    }
                }
            });
        }
    }

    createSlider(x, y, label, getVal, setVal) {
        this.add.text(x, y - 30, label, {
            fontFamily: 'Rajdhani',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        const trackW = 200;
        const trackH = 6;
        
        // Draw track
        const track = this.add.graphics();
        const drawTrack = () => {
            track.clear();
            // Default track background
            track.fillStyle(0x2e3d52, 0.7);
            track.fillRoundedRect(-trackW / 2, -trackH / 2, trackW, trackH, 3);
            
            // Fill track based on current volume
            const val = getVal();
            track.fillStyle(0x7dd3fc, 0.9);
            track.fillRoundedRect(-trackW / 2, -trackH / 2, trackW * val, trackH, 3);
        };
        
        const sliderContainer = this.add.container(x, y);
        sliderContainer.add(track);
        drawTrack();

        // Drag handle
        const handle = this.add.circle(-trackW / 2 + trackW * getVal(), 0, 10, 0xffffff);
        handle.setStrokeStyle(1.5, 0x7dd3fc);
        handle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(handle);
        
        sliderContainer.add(handle);

        const percentText = this.add.text(x + trackW / 2 + 35, y, `${Math.round(getVal() * 100)}%`, {
            fontFamily: 'Rajdhani',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        handle.on('drag', (pointer, dragX, dragY) => {
            // Constrain relative X coordinate inside container
            const minX = -trackW / 2;
            const maxX = trackW / 2;
            const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);
            handle.x = clampedX;
            
            const percent = (clampedX - minX) / trackW;
            setVal(percent);
            percentText.setText(`${Math.round(percent * 100)}%`);
            drawTrack();
        });

        // Clickable Track Area
        const clickArea = this.add.rectangle(0, 0, trackW, 20, 0xffffff, 0);
        clickArea.setInteractive({ useHandCursor: true });
        sliderContainer.add(clickArea);
        sliderContainer.sendToBack(clickArea);
        
        clickArea.on('pointerdown', (pointer, localX, localY) => {
            const relativeX = localX - trackW / 2;
            handle.x = relativeX;
            const percent = localX / trackW;
            setVal(percent);
            percentText.setText(`${Math.round(percent * 100)}%`);
            drawTrack();
            this.playClick();
        });
    }
}
