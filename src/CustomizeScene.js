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

        this.add.rectangle(0, 0, width, height, 0x090a0b, 0.75).setOrigin(0);

        // 🏷️ Title
        this.add.text(width / 2, 35, 'CUSTOMIZE', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // ← BACK button
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
        drawBackBg(0x0d121d, 0.7, 0x1f2b3e);
        backBtnContainer.add(backBg);

        const backText = this.add.text(backW / 2, backH / 2, '← BACK', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        backBtnContainer.add(backText);

        backBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, backW, backH), Phaser.Geom.Rectangle.Contains);
        backBtnContainer.on('pointerover', () => {
            drawBackBg(0x1b283a, 0.85, 0xff4444);
            backText.setColor('#ffffff');
        });
        backBtnContainer.on('pointerout', () => {
            drawBackBg(0x0d121d, 0.7, 0x1f2b3e);
            backText.setColor('#7fa3c7');
        });
        backBtnContainer.on('pointerdown', () => {
            this.playClick(); 
            this.scene.start('MenuScene');
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  LEFT SIDE — CHARACTER PREVIEW
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const previewX = width * 0.2;
        const previewY = height * 0.5;

        // Preview panel with rounded corners and border
        const previewPanelG = this.add.graphics();
        previewPanelG.fillStyle(0x0d121d, 0.85);
        previewPanelG.fillRoundedRect(previewX - 90, previewY - 150, 180, 300, 10);
        previewPanelG.lineStyle(1.5, 0x1f2b3e, 1);
        previewPanelG.strokeRoundedRect(previewX - 90, previewY - 150, 180, 300, 10);

        this.add.text(previewX, previewY - 130, 'PREVIEW', {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        // Character preview sprite — plays idle + blink
        this.previewSprite = this.add.sprite(previewX, previewY - 20, `${PlayerData.character}_idle`);
        this.previewSprite.setScale(0.45);
        this.previewSprite.anims.play(`${PlayerData.character}_preview`, true);

        const tint = PlayerData.getColorTint();
        if (tint) this.previewSprite.setTint(tint);

        // Info labels
        this.charLabel = this.add.text(previewX, previewY + 80, PlayerData.getCharacterInfo().name, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.colorLabel = this.add.text(previewX, previewY + 105, `COLOR: ${PlayerData.color.toUpperCase()}`, {
            fontFamily: '"Cormorant Garamond"',
            fontSize: '14px',
            color: '#7fa3c7'
        }).setOrigin(0.5);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  RIGHT SIDE — TABS + OPTIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const panelX = width * 0.42;
        const panelY = 80;
        const panelW = width * 0.53;
        const panelH = height - 120;

        const panelG = this.add.graphics();
        panelG.fillStyle(0x0d121d, 0.85);
        panelG.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
        panelG.lineStyle(1.5, 0x1f2b3e, 1);
        panelG.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  TABS — CHARACTER, COLOR, INSTRUCTIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const tabs = ['CHARACTER', 'COLOR', 'INSTRUCTIONS'];
        const tabKeys = ['character', 'color', 'instructions'];
        const tabW = panelW / tabs.length;

        this.tabButtons = [];

        tabs.forEach((tabName, i) => {
            const tx = panelX + i * tabW + tabW / 2;
            const ty = panelY + 25;
            const isActive = tabKeys[i] === this.activeTab;

            const tabContainer = this.add.container(tx, ty);
            const tbW = tabW - 14;
            const tbH = 36;

            const tbBg = this.add.graphics();
            const drawTabBg = (color, alpha, borderColor) => {
                tbBg.clear();
                tbBg.fillStyle(color, alpha);
                tbBg.fillRoundedRect(-tbW / 2, -tbH / 2, tbW, tbH, 6);
                tbBg.lineStyle(1.5, borderColor, 0.8);
                tbBg.strokeRoundedRect(-tbW / 2, -tbH / 2, tbW, tbH, 6);
            };
            drawTabBg(isActive ? 0x1b283a : 0x0d121d, isActive ? 0.85 : 0.6, isActive ? 0x7fa3c7 : 0x1f2b3e);
            tabContainer.add(tbBg);

            const tabText = this.add.text(0, 0, tabName, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '15px',
                fontWeight: 'bold',
                color: isActive ? '#ffffff' : '#7fa3c7'
            }).setOrigin(0.5);
            tabContainer.add(tabText);

            tabContainer.tabKey = tabKeys[i];
            tabContainer.drawTabBg = drawTabBg;
            tabContainer.tabText = tabText;

            tabContainer.setInteractive(new Phaser.Geom.Rectangle(-tbW / 2, -tbH / 2, tbW, tbH), Phaser.Geom.Rectangle.Contains);

            tabContainer.on('pointerover', () => {
                if (this.activeTab !== tabContainer.tabKey) {
                    drawTabBg(0x1b283a, 0.7, 0x7fa3c7);
                    tabText.setColor('#ffffff');
                }
            });
            
            tabContainer.on('pointerout', () => {
                if (this.activeTab !== tabContainer.tabKey) {
                    drawTabBg(0x0d121d, 0.6, 0x1f2b3e);
                    tabText.setColor('#7fa3c7');
                }
            });

            tabContainer.on('pointerdown', () => {
                this.playClick(); 
                this.activeTab = tabContainer.tabKey;
                this.renderOptions();

                this.tabButtons.forEach(tb => {
                    const isNowActive = tb.tabKey === this.activeTab;
                    tb.drawTabBg(isNowActive ? 0x1b283a : 0x0d121d, isNowActive ? 0.85 : 0.6, isNowActive ? 0x7fa3c7 : 0x1f2b3e);
                    tb.tabText.setColor(isNowActive ? '#ffffff' : '#7fa3c7');
                });
            });

            this.tabButtons.push(tabContainer);
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  OPTIONS CONTAINER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        this.optionsConfig = {
            x: panelX + 15,
            y: panelY + 60,
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
        if (this.optionWheelListener) {
            this.input.off('wheel', this.optionWheelListener);
            this.optionWheelListener = null;
        }

        this.optionElements.forEach(el => el.destroy());
        this.optionElements = [];

        const { x, y, w, itemH } = this.optionsConfig;

        // Viewport dimensions for options list masking/scrollbar
        const panelX = this.scale.width * 0.42;
        const panelY = 80;
        const panelW = this.scale.width * 0.53;
        const panelH = this.scale.height - 120;

        const maskX = panelX + 10;
        const maskY = panelY + 60;
        const maskW = panelW - 20;
        const maskH = panelH - 80;

        // Create container for list elements
        const scrollContainer = this.add.container(0, 0);
        this.optionElements.push(scrollContainer);

        // Create mask
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(maskX, maskY, maskW, maskH);
        const mask = maskShape.createGeometryMask();
        scrollContainer.setMask(mask);
        this.optionElements.push(maskShape);

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

            // Row background using Graphics
            const rowBg = this.add.graphics();
            const drawRow = (color, alpha, borderColor) => {
                rowBg.clear();
                rowBg.fillStyle(color, alpha);
                rowBg.fillRoundedRect(x, iy, w, itemH - 5, 6);
                rowBg.lineStyle(1.5, borderColor, 0.8);
                rowBg.strokeRoundedRect(x, iy, w, itemH - 5, 6);
            };
            drawRow(isSelected ? 0x1b283a : 0x0d121d, isSelected ? 0.85 : 0.5, isSelected ? 0x7fa3c7 : 0x1f2b3e);
            scrollContainer.add(rowBg);

            // Color indicator dot
            const dotColor = item.color || item.tint || 0x888888;
            const dot = this.add.circle(x + 20, iy + (itemH - 5) / 2, 8, dotColor);
            scrollContainer.add(dot);

            // Item name
            const nameText = this.add.text(x + 40, iy + 6, item.name, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '16px',
                fontWeight: 'bold',
                color: isSelected ? '#ffffff' : '#7fa3c7'
            });
            scrollContainer.add(nameText);

            // Description (for characters)
            if (item.desc) {
                const descText = this.add.text(x + 40, iy + 25, item.desc, {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '13px',
                    color: '#666666'
                });
                scrollContainer.add(descText);
            }

            // Selected checkmark
            if (isSelected) {
                const check = this.add.text(x + w - 30, iy + (itemH - 5) / 2, '✓', {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#7fa3c7'
                }).setOrigin(0.5);
                scrollContainer.add(check);
            }

            // Character preview sprite (only for character tab)
            if (this.activeTab === 'character') {
                const miniSprite = this.add.sprite(x + w - 70, iy + (itemH - 5) / 2, `${item.id}_idle`);
                miniSprite.setScale(0.15);
                miniSprite.anims.play(`${item.id}_preview`, true);
                scrollContainer.add(miniSprite);
            }

            // Color preview box (only for color tab)
            if (this.activeTab === 'color') {
                const previewBox = this.add.rectangle(
                    x + w - 70,
                    iy + (itemH - 5) / 2,
                    30, 30,
                    item.tint || 0xffffff
                ).setStrokeStyle(1.5, 0x1f2b3e);
                scrollContainer.add(previewBox);
            }

            // Invisible interactive area
            const hitArea = this.add.rectangle(x + w / 2, iy + (itemH - 5) / 2, w, itemH - 5, 0x000000, 0)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            scrollContainer.add(hitArea);

            hitArea.on('pointerover', () => {
                if (!isSelected) {
                    drawRow(0x1b283a, 0.8, 0x7fa3c7);
                    nameText.setColor('#ffffff');
                }
            });

            hitArea.on('pointerout', () => {
                if (!isSelected) {
                    drawRow(0x0d121d, 0.5, 0x1f2b3e);
                    nameText.setColor('#7fa3c7');
                }
            });

            hitArea.on('pointerdown', () => {
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

        let abilityCardH = 0;

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
                const cardH = 22 + data.lines.length * lineH + 12;
                abilityCardH = cardH + 10;

                // Card background graphics with character-specific colored border
                const cardG = this.add.graphics();
                cardG.fillStyle(0x0d121d, 0.9);
                cardG.fillRoundedRect(x, cardY, w, cardH, 8);
                cardG.lineStyle(1.5, data.color, 0.8);
                cardG.strokeRoundedRect(x, cardY, w, cardH, 8);
                scrollContainer.add(cardG);

                // Header tint graphic
                const headerG = this.add.graphics();
                headerG.fillStyle(data.color, 0.15);
                headerG.fillRoundedRect(x, cardY, w, 24, 6);
                scrollContainer.add(headerG);

                const hexCol = '#' + data.color.toString(16).padStart(6, '0');

                // Character name + HP badge
                const nameT = this.add.text(x + 12, cardY + 4, `${data.label}  ABILITIES`, {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: hexCol
                });
                scrollContainer.add(nameT);

                const hpT = this.add.text(x + w - 12, cardY + 4, `HP  ${data.hp}`, {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#ffffff'
                }).setOrigin(1, 0);
                scrollContainer.add(hpT);

                // Ability lines
                data.lines.forEach((line, li) => {
                    const isKey = !line.startsWith(' ');
                    const lt = this.add.text(x + 12, cardY + 28 + li * lineH, line, {
                        fontFamily: '"Cormorant Garamond"',
                        fontSize: '14px',
                        color: isKey ? '#ffffff' : '#7fa3c7'
                    });
                    scrollContainer.add(lt);
                });
            }
        }

        // 3. Set up scrolling limits and scrollbar UI for lists exceeding mask height
        const listTotalH = items.length * itemH + abilityCardH;
        const maxScroll = Math.min(0, -(listTotalH - maskH));

        if (listTotalH > maskH) {
            // Draw Scrollbar Track
            const trackX = panelX + panelW - 12;
            const track = this.add.graphics();
            track.fillStyle(0x0d121d, 0.6);
            track.fillRoundedRect(trackX, maskY, 6, maskH, 3);
            track.lineStyle(1.5, 0x1f2b3e, 1);
            track.strokeRoundedRect(trackX, maskY, 6, maskH, 3);
            this.optionElements.push(track);

            // Draw Scrollbar Handle
            const handleH = Math.max(30, (maskH / listTotalH) * maskH);
            const maxHandleY = maskH - handleH;
            const handle = this.add.rectangle(trackX, maskY, 6, handleH, 0x7fa3c7).setOrigin(0);
            this.optionElements.push(handle);

            // Wheel scroll handler
            const wheelListener = (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
                let targetY = scrollContainer.y - deltaY * 0.5;
                targetY = Phaser.Math.Clamp(targetY, maxScroll, 0);
                scrollContainer.y = targetY;

                // Update handle position
                const scrollRatio = targetY / maxScroll;
                handle.y = maskY + scrollRatio * maxHandleY;
            };
            this.input.on('wheel', wheelListener);
            this.optionWheelListener = wheelListener;

            // Handle drag behavior
            handle.setInteractive({ useHandCursor: true, draggable: true });
            handle.on('pointerover', () => handle.setFillStyle(0xffffff));
            handle.on('pointerout', () => handle.setFillStyle(0x7fa3c7));

            handle.on('drag', (pointer, dragX, dragY) => {
                let localY = dragY - maskY;
                localY = Phaser.Math.Clamp(localY, 0, maxHandleY);
                handle.y = maskY + localY;

                const scrollRatio = localY / maxHandleY;
                const targetY = scrollRatio * maxScroll;
                scrollContainer.y = targetY;
            });
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER INSTRUCTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderInstructions() {
        const { x, y, w } = this.optionsConfig;

        // Define viewport dimensions for masking/scrollbar
        const panelX = this.scale.width * 0.42;
        const panelY = 80;
        const panelW = this.scale.width * 0.53;
        const panelH = this.scale.height - 120;

        const maskX = panelX + 10;
        const maskY = panelY + 60;
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

            // Section header using rounded rect
            const headerBg = this.add.graphics();
            headerBg.fillStyle(0x0d121d, 0.95);
            headerBg.fillRoundedRect(x, curY, w, 24, 6);
            headerBg.lineStyle(1.5, color, 0.7);
            headerBg.strokeRoundedRect(x, curY, w, 24, 6);
            this.instrContainer.add(headerBg);

            const headerText = this.add.text(x + 10, curY + 3, title, {
                fontFamily: '"Cormorant Garamond"',
                fontSize: '15px',
                fontWeight: 'bold',
                color: hexColor
            });
            this.instrContainer.add(headerText);

            curY += 32;

            lines.forEach(line => {
                const isBullet = line.startsWith('•');
                const lineText = this.add.text(x + (isBullet ? 14 : 8), curY, line, {
                    fontFamily: '"Cormorant Garamond"',
                    fontSize: '14px',
                    color: isBullet ? '#ffffff' : hexColor,
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
            const track = this.add.graphics();
            track.fillStyle(0x0d121d, 0.6);
            track.fillRoundedRect(trackX, maskY, 6, maskH, 3);
            track.lineStyle(1.5, 0x1f2b3e, 1);
            track.strokeRoundedRect(trackX, maskY, 6, maskH, 3);
            this.optionElements.push(track);

            // Draw Scrollbar Handle
            const handleH = Math.max(30, (maskH / totalHeight) * maskH);
            const maxHandleY = maskH - handleH;
            const handle = this.add.rectangle(trackX, maskY, 6, handleH, 0x7fa3c7).setOrigin(0);
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
            handle.on('pointerover', () => handle.setFillStyle(0xffffff));
            handle.on('pointerout', () => handle.setFillStyle(0x7fa3c7));

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
