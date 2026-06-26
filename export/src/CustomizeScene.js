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
        this.cameras.main.setRoundPixels(false);
        const { width, height } = this.scale;

        // 🖼️ Background
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        // 🏷️ Title
        this.add.text(width / 2, 20, 'CUSTOMIZE', {
            fontFamily: '"Silkscreen"',
            fontSize: '26px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ← BACK button
        const backBtn = this.add.text(20, 15, '← BACK', {
            fontFamily: '"Silkscreen"',
            fontSize: '13px',
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
            fontFamily: '"Silkscreen"',
            fontSize: '12px',
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
            fontFamily: '"Silkscreen"',
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.colorLabel = this.add.text(previewX, previewY + 100, `COLOR: ${PlayerData.color.toUpperCase()}`, {
            fontFamily: '"Silkscreen"',
            fontSize: '10px',
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

        const tabs = ['CHARACTER', 'COLOR', 'INSTRUCTIONS'];
        const tabKeys = ['character', 'color', 'instructions'];
        const tabW = panelW / tabs.length;

        this.tabButtons = [];

        tabs.forEach((tabName, i) => {
            const tx = panelX + i * tabW + tabW / 2;
            const ty = panelY + 15;
            const isActive = tabKeys[i] === this.activeTab;

            const tabBtn = this.add.text(tx, ty, tabName, {
                fontFamily: '"Silkscreen"',
                fontSize: '14px',
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
        if (this.instrWheelListener) {
            this.input.off('wheel', this.instrWheelListener);
            this.instrWheelListener = null;
        }

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
            case 'instructions':
                this.renderInstructions();
                return;
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
            const nameText = this.add.text(x + 40, iy + 6, item.name, {
                fontFamily: '"Silkscreen"',
                fontSize: '14px',
                color: isSelected ? '#44ff44' : '#ffffff'
            });
            this.optionElements.push(nameText);

            // Description (for characters)
            if (item.desc) {
                const descText = this.add.text(x + 40, iy + 28, item.desc, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '11px',
                    color: '#666666'
                });
                this.optionElements.push(descText);
            }

            // Selected checkmark
            if (isSelected) {
                const check = this.add.text(x + w - 30, iy + (itemH - 5) / 2 - 8, '✓', {
                    fontFamily: '"Silkscreen"',
                    fontSize: '20px',
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

        // ── Character Ability Card (only in character tab) ───────
        if (this.activeTab === 'character') {
            const abilityData = {
                p1: {
                    label: 'KNIGHT',
                    color: 0x4488ff,
                    hp: 130,
                    lines: [
                        'R  — SHIELD BLOCK',
                        '       2s full immunity, repels nearby foes.',
                        '       4s cooldown.',
                        'T  — FORTRESS TAUNT',
                        '       5s / 50% damage reduction.',
                        '       Pulsing gold tint. 15s cooldown.',
                    ]
                },
                p2: {
                    label: 'SHADOW',
                    color: 0x9944ff,
                    hp: 100,
                    lines: [
                        'SHIFT  — DOUBLE DASH  (2 charges, 0.7s regen)',
                        'W x2   — DOUBLE JUMP  (mid-air)',
                        'R      — PHANTOM ORB',
                        '         Large (r=22), 1.8× speed orange orb.',
                        '         Orange trail particles follow it.',
                    ]
                },
                p3: {
                    label: 'BERSERKER',
                    color: 0xff4444,
                    hp: 100,
                    lines: [
                        'AUTO  — RAGE MODE  (≤ 30% HP)',
                        '        Speed +30%  •  Damage +50%',
                        '        Red pulsing tint, larger sprite.',
                        'AUTO  — UNDYING RAGE  (1st fatal hit)',
                        '        Restores FULL HP, activates permanent',
                        '        rage. HP drains slowly over time.',
                    ]
                }
            };

            const sel = PlayerData.character;
            const data = abilityData[sel];

            if (data) {
                const cardY = y + items.length * itemH + 10;
                const lineH = 18;
                const cardH = 22 + data.lines.length * lineH + 10;
                const hexCol = '#' + data.color.toString(16).padStart(6, '0');

                // Card background
                const cardBg = this.add.rectangle(x, cardY, w, cardH, 0x141428).setOrigin(0);
                cardBg.setStrokeStyle(2, data.color);
                this.optionElements.push(cardBg);

                // Header row: colored bar
                const headerBg = this.add.rectangle(x, cardY, w, 20, data.color, 0.15).setOrigin(0);
                this.optionElements.push(headerBg);

                // Character name + HP badge
                const nameT = this.add.text(x + 10, cardY + 4, `${data.label}  ABILITIES`, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '12px',
                    color: hexCol
                });
                this.optionElements.push(nameT);

                const hpT = this.add.text(x + w - 10, cardY + 4, `HP  ${data.hp}`, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '12px',
                    color: '#44ff44'
                }).setOrigin(1, 0);
                this.optionElements.push(hpT);

                // Ability lines
                data.lines.forEach((line, li) => {
                    const isKey = !line.startsWith(' ');
                    const lt = this.add.text(x + 12, cardY + 24 + li * lineH, line, {
                        fontFamily: '"Silkscreen"',
                        fontSize: '12px',
                        color: isKey ? '#ffffff' : '#888888'
                    });
                    this.optionElements.push(lt);
                });
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER INSTRUCTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderInstructions() {
        const { x, y, w } = this.optionsConfig;

        // Define viewport dimensions for masking/scrollbar
        const panelX = this.scale.width * 0.42;
        const panelY = 50;
        const panelW = this.scale.width * 0.53;
        const panelH = this.scale.height - 70;

        const maskX = panelX + 10;
        const maskY = panelY + 50;
        const maskW = panelW - 20;
        const maskH = panelH - 80;

        // 1. Create a container for the instructions
        this.instrContainer = this.add.container(0, 0);
        this.optionElements.push(this.instrContainer);

        // 2. Create the scroll viewport mask
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(maskX, maskY, maskW, maskH);
        const mask = maskShape.createGeometryMask();
        this.instrContainer.setMask(mask);
        this.optionElements.push(maskShape);

        // Render relative to coordinates starting at maskY
        let curY = maskY;

        const addSection = (title, color, lines) => {
            const hexColor = '#' + color.toString(16).padStart(6, '0');

            // Section header
            const headerBg = this.add.rectangle(x, curY, w, 24, 0x1e1e2e).setOrigin(0);
            headerBg.setStrokeStyle(1, color);
            this.instrContainer.add(headerBg);

            const headerText = this.add.text(x + 10, curY + 4, title, {
                fontFamily: '"Silkscreen"',
                fontSize: '13px',
                color: hexColor
            });
            this.instrContainer.add(headerText);

            curY += 28;

            lines.forEach(line => {
                const isBullet = line.startsWith('•');
                const lineText = this.add.text(x + (isBullet ? 14 : 8), curY, line, {
                    fontFamily: '"Silkscreen"',
                    fontSize: '11px',
                    color: isBullet ? '#cccccc' : hexColor,
                    wordWrap: { width: w - 24 }
                });
                this.instrContainer.add(lineText);
                curY += lineText.height + 6;
            });

            curY += 10; // gap between sections
        };

        // ── CONTROLS ───────────────────────────────────────────
        addSection('CONTROLS', 0x44aaff, [
            '• Move:        A / D',
            '• Jump:        W',
            '• High Jump:   Q  (also mid-air after normal jump)',
            '• Dash:        SHIFT',
            '• Attack:      SPACE',
            '• Spell / Ability:  R',
            '• Taunt:       T',
            '• Build Block: Left Click + Drag',
            '• Delete Block: X + Click  or  Right Click',
            '• Block Type:  1 = Normal  2 = Bounce  3 = Slide',
            '• Exit:        ESC',
        ]);

        // ── CHARACTER ABILITIES ────────────────────────────────
        addSection('CHARACTER ABILITIES', 0xffaa00, [
            '[ KNIGHT  P1 ] — HP: 130',
            '• Spell (R): Shield Block — 2s full immunity, repels foes',
            '• Taunt (T): FORTRESS — 5s  50% damage reduction',
            '               15s cooldown. Gold tint + particles.',
            '',
            '[ SHADOW  P2 ] — HP: 100',
            '• Dash (SHIFT): 2 charges, fast blink dash',
            '• Double Jump: press W again mid-air',
            '• Spell (R): Fast orange orb (r=22, speed x1.8)',
            '               Orange trail particles follow it.',
            '',
            '[ BERSERKER  P3 ] — HP: 100',
            '• Rage Mode: triggers at 30% HP — speed & damage +50%',
            '               Red pulsing tint, larger sprite, particles.',
            '• Undying Rage: first fatal hit restores FULL HP,',
            '               triggers permanent rage until HP drains.',
        ]);

        // ── BLOCK TYPES ────────────────────────────────────────
        addSection('BLOCK TYPES  (1 / 2 / 3)', 0x00e5ff, [
            '[ 1 ] NORMAL  — grey border, standard platform.',
            '[ 2 ] BOUNCE  — gold border, launches you high on contact.',
            '[ 3 ] SLIDE   — cyan border, ice friction, high speed boost.',
            '                 Momentum carries past edge briefly.',
            '',
            '• Build Points shown top-right (max 300,000).',
            '• Blocks decay after 15s (blink warning at 12s).',
            '• Placing a block over an enemy block subtracts it.',
        ]);

        // ── COMBAT TIPS ────────────────────────────────────────
        addSection('COMBAT TIPS', 0xff6688, [
            '• Spawn Protection: 2s invincibility on respawn (cyan blink).',
            '• Portals: step into glowing portals to teleport.',
            '• Enemies retreat at low HP (Shadow retreats most).',
            '• Berserker AI has shorter attack cooldown than others.',
            '• High Jump (Q) can be chained once per airtime.',
            '• Shield (Knight R) blocks 100% — but you cannot attack.',
            '• Kill enemies to rack up your kill count. Stay alive!',
        ]);

        // 3. Set up scrolling limits and scrollbar UI
        const totalHeight = curY - maskY;
        const maxScroll = Math.min(0, -(totalHeight - maskH));

        if (totalHeight > maskH) {
            // Draw Scrollbar Track
            const trackX = panelX + panelW - 12;
            const track = this.add.rectangle(trackX, maskY, 6, maskH, 0x1a1a1a).setOrigin(0);
            track.setStrokeStyle(1, 0x333333);
            this.optionElements.push(track);

            // Draw Scrollbar Handle
            const handleH = Math.max(30, (maskH / totalHeight) * maskH);
            const maxHandleY = maskH - handleH;
            const handle = this.add.rectangle(trackX, maskY, 6, handleH, 0x555555).setOrigin(0);
            this.optionElements.push(handle);

            // Wheel scroll handler
            const wheelListener = (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                if (this.activeTab !== 'instructions') return;
                let targetY = this.instrContainer.y - deltaY * 0.5;
                targetY = Phaser.Math.Clamp(targetY, maxScroll, 0);
                this.instrContainer.y = targetY;

                // Update handle position
                const scrollRatio = targetY / maxScroll;
                handle.y = maskY + scrollRatio * maxHandleY;
            };
            this.input.on('wheel', wheelListener);
            this.instrWheelListener = wheelListener;

            // Handle drag behavior
            handle.setInteractive({ useHandCursor: true, draggable: true });
            handle.on('pointerover', () => handle.setFillStyle(0x777777));
            handle.on('pointerout', () => handle.setFillStyle(0x555555));

            handle.on('drag', (pointer, dragX, dragY) => {
                let localY = dragY - maskY;
                localY = Phaser.Math.Clamp(localY, 0, maxHandleY);
                handle.y = maskY + localY;

                const scrollRatio = localY / maxHandleY;
                const targetY = scrollRatio * maxScroll;
                this.instrContainer.y = targetY;
            });
        }
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
