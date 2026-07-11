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

        // ─── State ────────────────────────────────────────
        this.activeTab = 'audio_video';
        this.rebindingAction = null;
        this.rebindListener = null;
        this.warningMsg = '';
        this.warningTimer = null;

        this.audioVideoContainer = this.add.container(0, 0).setDepth(1);
        this.controlsContainer = this.add.container(0, 0).setDepth(1);

        this.events.once('shutdown', () => {
            this.cancelRebinding();
            if (this.warningTimer) {
                this.warningTimer.remove();
                this.warningTimer = null;
            }
        });

        // ─── ESC Key Listener ─────────────────────────────
        this.input.keyboard.on('keydown-ESC', () => {
            this.playClick();
            this.cancelRebinding();
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
        drawBackBg(0x101626, 0.7, 0x223147);
        backBtnContainer.add(backBg);

        const backText = this.add.text(backW / 2, backH / 2, '← BACK', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#83a1c1'
        }).setOrigin(0.5);
        backBtnContainer.add(backText);

        backBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, backW, backH), Phaser.Geom.Rectangle.Contains);
        backBtnContainer.on('pointerover', () => {
            drawBackBg(0x1c2b42, 0.85, 0x9cbdf2);
            backText.setColor('#ffffff');
        });
        backBtnContainer.on('pointerout', () => {
            drawBackBg(0x101626, 0.7, 0x223147);
            backText.setColor('#83a1c1');
        });
        backBtnContainer.on('pointerdown', () => {
            this.playClick();
            this.cancelRebinding();
            if (this.fromScene === 'GameScene') {
                this.scene.stop('SettingsScene');
            } else {
                this.scene.start('MenuScene');
            }
        });

        // ─── Settings Panel ──────────────────────────────
        const panelW = 500;
        const hasLeaveBtn = this.fromScene === 'GameScene';
        const panelH = hasLeaveBtn ? 450 : 365;
        const panelX = width / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2 + (hasLeaveBtn ? 35 : 55);

        const panelG = this.add.graphics();
        panelG.fillStyle(0x101626, 0.85);
        panelG.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
        panelG.lineStyle(1.5, 0x223147, 1);
        panelG.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

        // ─── Tabs ─────────────────────────────────────────
        const tabW = 180;
        const tabH = 35;
        const tabY = panelY + 50;

        // Tab 1: Audio & Video
        const tabAudioContainer = this.add.container(width / 2 - 100 - tabW / 2, tabY - tabH / 2);
        this.tabAudioBg = this.add.graphics();
        this.tabAudioText = this.add.text(tabW / 2, tabH / 2, 'AUDIO & VIDEO', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        tabAudioContainer.add(this.tabAudioBg);
        tabAudioContainer.add(this.tabAudioText);

        // Tab 2: Controls
        const tabControlsContainer = this.add.container(width / 2 + 100 - tabW / 2, tabY - tabH / 2);
        this.tabControlsBg = this.add.graphics();
        this.tabControlsText = this.add.text(tabW / 2, tabH / 2, 'CONTROLS', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        tabControlsContainer.add(this.tabControlsBg);
        tabControlsContainer.add(this.tabControlsText);

        const updateTabVisuals = () => {
            const isAudioActive = this.activeTab === 'audio_video';
            
            // Draw Audio tab
            this.tabAudioBg.clear();
            this.tabAudioBg.fillStyle(isAudioActive ? 0x1c2b42 : 0x101626, 0.85);
            this.tabAudioBg.fillRoundedRect(0, 0, tabW, tabH, 6);
            this.tabAudioBg.lineStyle(1.5, isAudioActive ? 0x9cbdf2 : 0x223147, 0.9);
            this.tabAudioBg.strokeRoundedRect(0, 0, tabW, tabH, 6);
            this.tabAudioText.setColor(isAudioActive ? '#ffffff' : '#83a1c1');

            // Draw Controls tab
            this.tabControlsBg.clear();
            this.tabControlsBg.fillStyle(!isAudioActive ? 0x1c2b42 : 0x101626, 0.85);
            this.tabControlsBg.fillRoundedRect(0, 0, tabW, tabH, 6);
            this.tabControlsBg.lineStyle(1.5, !isAudioActive ? 0x9cbdf2 : 0x223147, 0.9);
            this.tabControlsBg.strokeRoundedRect(0, 0, tabW, tabH, 6);
            this.tabControlsText.setColor(!isAudioActive ? '#ffffff' : '#83a1c1');

            // Toggle container visibilities
            this.audioVideoContainer.setVisible(isAudioActive);
            this.controlsContainer.setVisible(!isAudioActive);
        };

        // Interaction
        tabAudioContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, tabW, tabH), Phaser.Geom.Rectangle.Contains);
        tabAudioContainer.on('pointerover', () => {
            if (this.activeTab !== 'audio_video') {
                this.tabAudioBg.lineStyle(1.5, 0xffffff, 0.5);
                this.tabAudioBg.strokeRoundedRect(0, 0, tabW, tabH, 6);
            }
        });
        tabAudioContainer.on('pointerout', () => updateTabVisuals());
        tabAudioContainer.on('pointerdown', () => {
            this.playClick();
            this.cancelRebinding();
            this.warningMsg = '';
            if (this.warningTimer) {
                this.warningTimer.remove();
                this.warningTimer = null;
            }
            this.activeTab = 'audio_video';
            updateTabVisuals();
        });

        tabControlsContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, tabW, tabH), Phaser.Geom.Rectangle.Contains);
        tabControlsContainer.on('pointerover', () => {
            if (this.activeTab === 'audio_video') {
                this.tabControlsBg.lineStyle(1.5, 0xffffff, 0.5);
                this.tabControlsBg.strokeRoundedRect(0, 0, tabW, tabH, 6);
            }
        });
        tabControlsContainer.on('pointerout', () => updateTabVisuals());
        tabControlsContainer.on('pointerdown', () => {
            this.playClick();
            this.cancelRebinding();
            this.warningMsg = '';
            if (this.warningTimer) {
                this.warningTimer.remove();
                this.warningTimer = null;
            }
            this.activeTab = 'controls';
            updateTabVisuals();
            this.drawControlsTab();
        });

        // ─── Music Control Slider ─────────────────────────
        const musicY = panelY + 145;
        this.createSlider(width / 2, musicY, 'MUSIC VOLUME', 
            () => PlayerData.musicVolume, 
            (val) => PlayerData.setMusicVolume(val),
            this.audioVideoContainer
        );

        // ─── SFX Control Slider ───────────────────────────
        const sfxY = panelY + 225;
        this.createSlider(width / 2, sfxY, 'SFX VOLUME', 
            () => PlayerData.sfxVolume, 
            (val) => PlayerData.setSfxVolume(val),
            this.audioVideoContainer
        );

        // ─── Graphics Quality Control ─────────────────────
        const graphicsY = panelY + 305;
        const graphicsTitle = this.add.text(width / 2, graphicsY - 32, 'GRAPHICS QUALITY', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#83a1c1'
        }).setOrigin(0.5);
        this.audioVideoContainer.add(graphicsTitle);

        const btnW = 100;
        const btnH = 32;

        // Low Quality Button
        const lowContainer = this.add.container(width / 2 - 60 - btnW / 2, graphicsY - btnH / 2);
        const lowBg = this.add.graphics();
        const lowText = this.add.text(btnW / 2, btnH / 2, 'LOW', {
            fontFamily: 'Rajdhani',
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        lowContainer.add(lowBg);
        lowContainer.add(lowText);
        this.audioVideoContainer.add(lowContainer);

        // High Quality Button
        const highContainer = this.add.container(width / 2 + 60 - btnW / 2, graphicsY - btnH / 2);
        const highBg = this.add.graphics();
        const highText = this.add.text(btnW / 2, btnH / 2, 'HIGH', {
            fontFamily: 'Rajdhani',
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        highContainer.add(highBg);
        highContainer.add(highText);
        this.audioVideoContainer.add(highContainer);

        const drawQualityButtons = () => {
            const isLow = PlayerData.graphicsQuality === 'low';
            
            // Draw Low
            lowBg.clear();
            lowBg.fillStyle(isLow ? 0x1c2b42 : 0x101626, 0.85);
            lowBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            lowBg.lineStyle(1.5, isLow ? 0x9cbdf2 : 0x223147, 0.9);
            lowBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            lowText.setColor(isLow ? '#ffffff' : '#83a1c1');

            // Draw High
            highBg.clear();
            highBg.fillStyle(!isLow ? 0x1c2b42 : 0x101626, 0.85);
            highBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            highBg.lineStyle(1.5, !isLow ? 0x9cbdf2 : 0x223147, 0.9);
            highBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
            highText.setColor(!isLow ? '#ffffff' : '#83a1c1');
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
            const leaveY = panelY + 385;
            const leaveBtn = this.add.container(width / 2 - 100, leaveY - btnH / 2);
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
                this.cancelRebinding();
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
            this.audioVideoContainer.add(leaveBtn);
        }

        updateTabVisuals();
    }

    cancelRebinding() {
        if (this.rebindingAction) {
            this.rebindingAction = null;
            if (this.rebindListener) {
                this.input.keyboard.off('keydown', this.rebindListener);
                this.rebindListener = null;
            }
        }
    }

    startRebinding(actionKey) {
        this.cancelRebinding();

        this.rebindingAction = actionKey;
        this.drawControlsTab();

        this.rebindListener = (event) => {
            const keyCode = event.keyCode;
            
            // ESC key cancels
            if (keyCode === Phaser.Input.Keyboard.KeyCodes.ESC) {
                this.cancelRebinding();
                this.drawControlsTab();
                this.playClick();
                return;
            }

            // Check if key is already bound to another action
            let alreadyBoundAction = null;
            for (const key in PlayerData.controls) {
                if (key !== actionKey && PlayerData.controls[key] === keyCode) {
                    alreadyBoundAction = key;
                    break;
                }
            }

            if (alreadyBoundAction) {
                const actionLabel = alreadyBoundAction.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
                const keyLabel = PlayerData.getKeyLabel(keyCode);
                this.warningMsg = `KEY "${keyLabel}" IS ALREADY BOUND TO ${actionLabel}`;
                
                this.cancelRebinding();
                this.drawControlsTab();
                this.playClick();
                return;
            }

            // Bind new key
            PlayerData.setControlKey(actionKey, keyCode);
            
            // Clean up
            this.cancelRebinding();
            this.warningMsg = ''; // clear warning on successful bind
            
            this.drawControlsTab();
            this.playClick();
        };

        this.input.keyboard.on('keydown', this.rebindListener);
    }

    drawControlsTab() {
        this.controlsContainer.removeAll(true);

        const { width, height } = this.scale;
        const panelW = 500;
        const hasLeaveBtn = this.fromScene === 'GameScene';
        const panelH = hasLeaveBtn ? 450 : 365;
        const panelX = width / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2 + (hasLeaveBtn ? 35 : 55);

        const leftColX = width / 2 - 110;
        const rightColX = width / 2 + 110;
        const startY = panelY + 120;
        const rowSpacing = 48;

        const leftActions = [
            { key: 'left', label: 'MOVE LEFT' },
            { key: 'right', label: 'MOVE RIGHT' },
            { key: 'jump', label: 'JUMP' },
            { key: 'down', label: 'CROUCH / DOWN' },
            { key: 'dash', label: 'DASH' }
        ];

        const rightActions = [
            { key: 'attack', label: 'ATTACK' },
            { key: 'highJump', label: 'HIGH JUMP' },
            { key: 'spell', label: 'SPELL' },
            { key: 'taunt', label: 'TAUNT' }
        ];

        // Draw left column
        leftActions.forEach((act, idx) => {
            const y = startY + idx * rowSpacing;
            this.createKeyRebindUI(leftColX, y, act.key, act.label);
        });

        // Draw right column
        rightActions.forEach((act, idx) => {
            const y = startY + idx * rowSpacing;
            this.createKeyRebindUI(rightColX, y, act.key, act.label);
        });

        // Draw Reset Button at row 4 of right column
        const resetY = startY + 4 * rowSpacing;
        this.createResetButtonUI(rightColX, resetY);

        // Draw Warning Text if any
        if (this.warningMsg) {
            const warningText = this.add.text(width / 2, panelY + 348, this.warningMsg, {
                fontFamily: 'Rajdhani',
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#ef4444'
            }).setOrigin(0.5);
            this.controlsContainer.add(warningText);

            if (this.warningTimer) {
                this.warningTimer.remove();
            }
            this.warningTimer = this.time.delayedCall(3000, () => {
                this.warningMsg = '';
                this.drawControlsTab();
            });
        }
    }

    createKeyRebindUI(colX, y, actionKey, label) {
        // Label on the left
        const lbl = this.add.text(colX - 110, y, label, {
            fontFamily: 'Rajdhani',
            fontSize: '15px',
            fontWeight: 'bold',
            color: '#83a1c1'
        }).setOrigin(0, 0.5);
        this.controlsContainer.add(lbl);

        // Button on the right
        const btnW = 90;
        const btnH = 30;
        const btnContainer = this.add.container(colX + 15, y - btnH / 2);
        
        const isRebinding = this.rebindingAction === actionKey;
        const currentKeyCode = PlayerData.controls[actionKey];
        const keyTextStr = isRebinding ? 'PRESS KEY' : PlayerData.getKeyLabel(currentKeyCode);

        const btnBg = this.add.graphics();
        const drawBtnBg = (color, alpha, borderColor) => {
            btnBg.clear();
            btnBg.fillStyle(color, alpha);
            btnBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            btnBg.lineStyle(1.5, borderColor, 0.9);
            btnBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
        };

        if (isRebinding) {
            drawBtnBg(0x3b2311, 0.85, 0xf59e0b);
        } else {
            drawBtnBg(0x101626, 0.85, 0x223147);
        }
        btnContainer.add(btnBg);

        const btnText = this.add.text(btnW / 2, btnH / 2, keyTextStr, {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: isRebinding ? '#f59e0b' : '#ffffff'
        }).setOrigin(0.5);
        btnContainer.add(btnText);

        btnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        
        btnContainer.on('pointerover', () => {
            if (!isRebinding) {
                drawBtnBg(0x1c2b42, 0.85, 0xffffff);
            }
        });
        btnContainer.on('pointerout', () => {
            if (!isRebinding) {
                drawBtnBg(0x101626, 0.85, 0x223147);
            } else {
                drawBtnBg(0x3b2311, 0.85, 0xf59e0b);
            }
        });
        btnContainer.on('pointerdown', () => {
            this.playClick();
            this.startRebinding(actionKey);
        });

        this.controlsContainer.add(btnContainer);
    }

    createResetButtonUI(colX, y) {
        const btnW = 180;
        const btnH = 30;
        const btnContainer = this.add.container(colX - 80, y - btnH / 2);

        const btnBg = this.add.graphics();
        const drawBtnBg = (color, alpha, borderColor) => {
            btnBg.clear();
            btnBg.fillStyle(color, alpha);
            btnBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            btnBg.lineStyle(1.5, borderColor, 0.9);
            btnBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
        };
        drawBtnBg(0x1e1b4b, 0.7, 0x4338ca);
        btnContainer.add(btnBg);

        const btnText = this.add.text(btnW / 2, btnH / 2, 'RESET TO DEFAULT', {
            fontFamily: 'Rajdhani',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#a5b4fc'
        }).setOrigin(0.5);
        btnContainer.add(btnText);

        btnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        
        btnContainer.on('pointerover', () => {
            drawBtnBg(0x312e81, 0.85, 0x6366f1);
            btnText.setColor('#ffffff');
        });
        btnContainer.on('pointerout', () => {
            drawBtnBg(0x1e1b4b, 0.7, 0x4338ca);
            btnText.setColor('#a5b4fc');
        });
        btnContainer.on('pointerdown', () => {
            this.playClick();
            this.cancelRebinding();
            PlayerData.resetControls();
            this.drawControlsTab();
        });

        this.controlsContainer.add(btnContainer);
    }

    createSlider(x, y, label, getVal, setVal, targetContainer) {
        // Center-aligned label above the slider
        const titleText = this.add.text(x, y - 26, label, {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#83a1c1'
        }).setOrigin(0.5);
        targetContainer.add(titleText);

        const trackW = 200;
        const trackH = 6;
        
        const track = this.add.graphics();
        const drawTrack = () => {
            track.clear();
            track.fillStyle(0x223147, 0.7);
            track.fillRoundedRect(-trackW / 2, -trackH / 2, trackW, trackH, 3);
            
            const val = getVal();
            track.fillStyle(0x9cbdf2, 0.9);
            track.fillRoundedRect(-trackW / 2, -trackH / 2, trackW * val, trackH, 3);
        };
        
        const sliderContainer = this.add.container(x, y);
        sliderContainer.add(track);
        drawTrack();
        targetContainer.add(sliderContainer);

        const handle = this.add.circle(-trackW / 2 + trackW * getVal(), 0, 9, 0xffffff);
        handle.setStrokeStyle(1.5, 0x9cbdf2);
        handle.setInteractive({ useHandCursor: true });
        this.input.setDraggable(handle);
        
        sliderContainer.add(handle);

        // Percentage text on the right side of the slider
        const percentText = this.add.text(x + trackW / 2 + 35, y, `${Math.round(getVal() * 100)}%`, {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        targetContainer.add(percentText);

        handle.on('drag', (pointer, dragX, dragY) => {
            const minX = -trackW / 2;
            const maxX = trackW / 2;
            const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);
            handle.x = clampedX;
            
            const percent = (clampedX - minX) / trackW;
            setVal(percent);
            percentText.setText(`${Math.round(percent * 100)}%`);
            drawTrack();
        });

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
