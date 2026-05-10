import PlayerData from './PlayerData.js';

export default class CustomizeScene extends Phaser.Scene {
    constructor() {
        super('CustomizeScene');
        this.activeTab = 'character';
    }

    playClick() {
        try {
            if (this.cache.audio.exists('sfx_click')) {
                this.sound.play('sfx_click', { volume: 0.3 });
            }
        } catch (e) {
            // ignore
        }
    }

    create() {
        const { width, height } = this.scale;

        // 🖼️ Background
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        // 🏷️ Title
        this.add.text(width / 2, 20, 'CUSTOMIZE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ← BACK button
        const backBtn = this.add.text(20, 15, '← BACK', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ff4444',
            backgroundColor: '#222',
            padding: { x: 8, y: 5 }
        })
            .setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => {
            backBtn.setStyle({ backgroundColor: '#555' });
            backBtn.setScale(1.05);
        });
        backBtn.on('pointerout', () => {
            backBtn.setStyle({ backgroundColor: '#222' });
            backBtn.setScale(1);
        });
        backBtn.on('pointerdown', () => {
            this.playClick(); 
            this.scene.start('MenuScene');
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — CHARACTER PREVIEW
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.2;
        const previewY = height * 0.5;

        this.add.rectangle(previewX, previewY, 180, 300, 0x111111, 0.8)
            .setStrokeStyle(2, 0x333333);

        this.add.text(previewX, previewY - 135, 'PREVIEW', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#888888'
        }).setOrigin(0.5);

        // Character preview sprite — plays idle + blink
        this.previewSprite = this.add.sprite(previewX, previewY - 20, `${PlayerData.character}_idle`);
        this.previewSprite.setScale(0.45);
        this.previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        const tint = PlayerData.getColorTint();
        if (tint) this.previewSprite.setTint(tint);

        // Info labels
        this.charLabel = this.add.text(previewX, previewY + 80, PlayerData.getCharacterInfo().name, {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.colorLabel = this.add.text(previewX, previewY + 100, `COLOR: ${PlayerData.color.toUpperCase()}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '7px',
            color: '#888888'
        }).setOrigin(0.5);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  RIGHT SIDE — TABS + OPTIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const panelX = width * 0.42;
        const panelY = 50;
        const panelW = width * 0.53;
        const panelH = height - 70;

        this.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x111111, 0.8)
            .setStrokeStyle(1, 0x333333);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  TABS — Only CHARACTER and COLOR
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const tabs = ['CHARACTER', 'COLOR'];
        const tabKeys = ['character', 'color'];
        const tabW = panelW / tabs.length;

        this.tabButtons = [];

        tabs.forEach((tabName, i) => {
            const tx = panelX + i * tabW + tabW / 2;
            const ty = panelY + 15;
            const isActive = tabKeys[i] === this.activeTab;

            const tabBtn = this.add.text(tx, ty, tabName, {
                fontFamily: '"Press Start 2P"',
                fontSize: '9px',
                color: isActive ? '#ffff00' : '#666666',
                backgroundColor: isActive ? '#333' : '#1a1a1a',
                padding: { x: 12, y: 8 }
            })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            tabBtn.tabKey = tabKeys[i];

            tabBtn.on('pointerover', () => {
                if (this.activeTab !== tabBtn.tabKey) {
                    tabBtn.setStyle({ backgroundColor: '#2a2a2a' });
                }
            });
            tabBtn.on('pointerout', () => {
                if (this.activeTab !== tabBtn.tabKey) {
                    tabBtn.setStyle({ backgroundColor: '#1a1a1a' });
                }
            });

            tabBtn.on('pointerdown', () => {
                this.playClick(); 
                this.activeTab = tabBtn.tabKey;
                this.renderOptions();

                this.tabButtons.forEach(tb => {
                    if (tb.tabKey === this.activeTab) {
                        tb.setStyle({ color: '#ffff00', backgroundColor: '#333' });
                    } else {
                        tb.setStyle({ color: '#666666', backgroundColor: '#1a1a1a' });
                    }
                });
            });

            this.tabButtons.push(tabBtn);
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  OPTIONS CONTAINER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        this.optionsConfig = {
            x: panelX + 15,
            y: panelY + 45,
            w: panelW - 30,
            itemH: 50
        };

        this.optionElements = [];

        this.renderOptions();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER OPTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderOptions() {
        this.optionElements.forEach(el => el.destroy());
        this.optionElements = [];

        const { x, y, w, itemH } = this.optionsConfig;

        let items = [];
        let currentSelection = '';

        switch (this.activeTab) {
            case 'character':
                items = PlayerData.characters;
                currentSelection = PlayerData.character;
                break;
            case 'color':
                items = PlayerData.colors;
                currentSelection = PlayerData.color;
                break;
        }

        items.forEach((item, index) => {
            const iy = y + index * itemH;
            const isSelected = item.id === currentSelection;

            // Item background
            const itemBg = this.add.rectangle(
                x, iy,
                w, itemH - 5,
                isSelected ? 0x2a2a2a : 0x1a1a1a
            )
                .setOrigin(0)
                .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x44ff44 : 0x333333)
                .setInteractive({ useHandCursor: true });
            this.optionElements.push(itemBg);

            // Color indicator dot
            const dotColor = item.color || item.tint || 0x888888;
            const dot = this.add.circle(x + 20, iy + (itemH - 5) / 2, 8, dotColor);
            this.optionElements.push(dot);

            // Item name
            const nameText = this.add.text(x + 40, iy + 8, item.name, {
                fontFamily: '"Press Start 2P"',
                fontSize: '9px',
                color: isSelected ? '#44ff44' : '#ffffff'
            });
            this.optionElements.push(nameText);

            // Description (for characters)
            if (item.desc) {
                const descText = this.add.text(x + 40, iy + 26, item.desc, {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '6px',
                    color: '#666666'
                });
                this.optionElements.push(descText);
            }

            // Selected checkmark
            if (isSelected) {
                const check = this.add.text(x + w - 30, iy + (itemH - 5) / 2 - 6, '✓', {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '12px',
                    color: '#44ff44'
                });
                this.optionElements.push(check);
            }

            // Character preview sprite (only for character tab)
            if (this.activeTab === 'character') {
                const miniSprite = this.add.sprite(x + w - 70, iy + (itemH - 5) / 2, `${item.id}_idle`);
                miniSprite.setScale(0.15);
                miniSprite.anims.play(`${item.id}_preview`, true);
                this.optionElements.push(miniSprite);
            }

            // Color preview box (only for color tab)
            if (this.activeTab === 'color') {
                const previewBox = this.add.rectangle(
                    x + w - 70,
                    iy + (itemH - 5) / 2,
                    30, 30,
                    item.tint || 0xffffff
                ).setStrokeStyle(1, 0x444444);
                this.optionElements.push(previewBox);
            }

            // Hover
            itemBg.on('pointerover', () => {
                if (!isSelected) {
                    itemBg.setFillStyle(0x222222);
                    nameText.setColor('#ffff00');
                }
            });

            itemBg.on('pointerout', () => {
                if (!isSelected) {
                    itemBg.setFillStyle(0x1a1a1a);
                    nameText.setColor('#ffffff');
                }
            });

            // Click to select
            itemBg.on('pointerdown', () => {
                this.playClick(); 
                switch (this.activeTab) {
                    case 'character':
                        PlayerData.setCharacter(item.id);
                        break;
                    case 'color':
                        PlayerData.setColor(item.id);
                        break;
                }

                console.log(`✅ ${this.activeTab} set to: ${item.id}`);

                this.updatePreview();
                this.renderOptions();
            });
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  UPDATE PREVIEW
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    updatePreview() {
        // Update sprite texture and animation
        this.previewSprite.anims.stop();
        this.previewSprite.setTexture(`${PlayerData.character}_idle`);
        this.previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        // Update tint
        const tint = PlayerData.getColorTint();
        if (tint) {
            this.previewSprite.setTint(tint);
        } else {
            this.previewSprite.clearTint();
        }

        // Update labels
        this.charLabel.setText(PlayerData.getCharacterInfo().name);
        this.colorLabel.setText(`COLOR: ${PlayerData.color.toUpperCase()}`);
    }
}