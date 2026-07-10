import SocketManager from './SocketManager.js';
import PlayerData from './PlayerData.js';

export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
        this.serverList = [];
        this.serverListElements = [];
    }

    // preload removed because 'bg' is already loaded in PreloadScene

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

        const data = this.scene.settings.data || {};
        this.selectedCharacter = data.character || 'p1';

        // ─── Background ───────────────────────────────────
        this.add.image(0, 0, 'menu_bg')
            .setOrigin(0)
            .setDisplaySize(width, height);

        this.add.rectangle(0, 0, width, height, 0x090a0b, 0.75).setOrigin(0);

        // ─── Title ────────────────────────────────────────
        this.add.text(width / 2, 35, 'MULTIPLAYER LOBBY', {
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
        drawBackBg(0x0d121d, 0.7, 0x1f2b3e);
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
            drawBackBg(0x0d121d, 0.7, 0x1f2b3e);
            backText.setColor('#7fa3c7');
        });
        backBtnContainer.on('pointerdown', () => {
            this.cleanup();
            this.playClick(); 
            this.scene.start('MenuScene');
        });

        // ─── Left Panel (Server List) ─────────────────────
        const panelLeft = {
            x: 30,
            y: 80,
            w: width * 0.6,
            h: height - 120
        };

        const panelLeftG = this.add.graphics();
        panelLeftG.fillStyle(0x0d121d, 0.85);
        panelLeftG.fillRoundedRect(panelLeft.x, panelLeft.y, panelLeft.w, panelLeft.h, 10);
        panelLeftG.lineStyle(1.5, 0x1f2b3e, 1);
        panelLeftG.strokeRoundedRect(panelLeft.x, panelLeft.y, panelLeft.w, panelLeft.h, 10);

        this.add.text(panelLeft.x + 20, panelLeft.y + 15, 'AVAILABLE SERVERS', {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        });

        const headerY = panelLeft.y + 45;

        this.add.text(panelLeft.x + 20, headerY, 'NAME', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        });
        this.add.text(panelLeft.x + panelLeft.w * 0.5, headerY, 'PLAYERS', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        });
        this.add.text(panelLeft.x + panelLeft.w * 0.75, headerY, 'STATUS', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        });

        this.add.rectangle(
            panelLeft.x + 15, headerY + 18,
            panelLeft.w - 30, 1,
            0x1f2b3e
        ).setOrigin(0);

        this.listConfig = {
            x: panelLeft.x,
            startY: headerY + 30,
            w: panelLeft.w,
            rowH: 44
        };

        this.loadingText = this.add.text(
            panelLeft.x + panelLeft.w / 2,
            this.listConfig.startY + 60,
            'Connecting...',
            {
                fontFamily: 'Rajdhani',
                fontSize: '18px',
                color: '#7fa3c7'
            }
        ).setOrigin(0.5);

        // ─── Right Panel (Create Server) ──────────────────
        const panelRight = {
            x: panelLeft.x + panelLeft.w + 20,
            y: 80,
            w: width - (panelLeft.x + panelLeft.w + 20) - 30,
            h: height - 120
        };

        const panelRightG = this.add.graphics();
        panelRightG.fillStyle(0x0d121d, 0.85);
        panelRightG.fillRoundedRect(panelRight.x, panelRight.y, panelRight.w, panelRight.h, 10);
        panelRightG.lineStyle(1.5, 0x1f2b3e, 1);
        panelRightG.strokeRoundedRect(panelRight.x, panelRight.y, panelRight.w, panelRight.h, 10);

        this.add.text(
            panelRight.x + panelRight.w / 2,
            panelRight.y + 20,
            'CREATE SERVER',
            {
                fontFamily: 'Rajdhani',
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5, 0);

        // ── Server Name Input ─────────────────────────────
        this.add.text(panelRight.x + 20, panelRight.y + 80, 'SERVER NAME:', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        });

        // Input background (designed like a button field)
        const inputContainer = this.add.container(panelRight.x + 20, panelRight.y + 105);
        const inputW = panelRight.w - 40;
        const inputH = 40;
        const inputBg = this.add.graphics();
        const drawInputBg = (color, alpha, borderColor) => {
            inputBg.clear();
            inputBg.fillStyle(color, alpha);
            inputBg.fillRoundedRect(0, 0, inputW, inputH, 6);
            inputBg.lineStyle(1.5, borderColor, 0.8);
            inputBg.strokeRoundedRect(0, 0, inputW, inputH, 6);
        };
        drawInputBg(0x0d121d, 0.6, 0x1f2b3e);
        inputContainer.add(inputBg);

        this.serverNameValue = 'My Server';

        this.serverNameText = this.add.text(
            15,
            inputH / 2,
            this.serverNameValue,
            {
                fontFamily: 'Rajdhani',
                fontSize: '18px',
                color: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        inputContainer.add(this.serverNameText);

        inputContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, inputW, inputH), Phaser.Geom.Rectangle.Contains);
        inputContainer.on('pointerover', () => {
            drawInputBg(0x17212e, 0.8, 0x5f7793);
        });
        inputContainer.on('pointerout', () => {
            drawInputBg(0x0d121d, 0.6, 0x1f2b3e);
        });
        inputContainer.on('pointerdown', () => {
            const name = prompt('Enter server name:', this.serverNameValue);
            if (name && name.trim().length > 0) {
                this.serverNameValue = name.trim().substring(0, 20);
                this.serverNameText.setText(this.serverNameValue);
            }
        });

        // ── Max Players Selector ──────────────────────────
        this.add.text(panelRight.x + 20, panelRight.y + 170, 'MAX PLAYERS:', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        });

        this.maxPlayers = 4;

        // Minus Button
        const minusContainer = this.add.container(panelRight.x + 20, panelRight.y + 195);
        const selW = 35;
        const selH = 35;
        const minusBg = this.add.graphics();
        const drawMinusBg = (color, alpha, borderColor) => {
            minusBg.clear();
            minusBg.fillStyle(color, alpha);
            minusBg.fillRoundedRect(0, 0, selW, selH, 6);
            minusBg.lineStyle(1.5, borderColor, 0.8);
            minusBg.strokeRoundedRect(0, 0, selW, selH, 6);
        };
        drawMinusBg(0x0d121d, 0.7, 0x1f2b3e);
        minusContainer.add(minusBg);

        const minusText = this.add.text(selW / 2, selH / 2, '−', {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        minusContainer.add(minusText);

        // Max Players Label
        this.maxPlayersText = this.add.text(
            panelRight.x + 85,
            panelRight.y + 212,
            String(this.maxPlayers),
            {
                fontFamily: 'Rajdhani',
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#ffffff'
            }
        ).setOrigin(0.5);

        // Plus Button
        const plusContainer = this.add.container(panelRight.x + 115, panelRight.y + 195);
        const plusBg = this.add.graphics();
        const drawPlusBg = (color, alpha, borderColor) => {
            plusBg.clear();
            plusBg.fillStyle(color, alpha);
            plusBg.fillRoundedRect(0, 0, selW, selH, 6);
            plusBg.lineStyle(1.5, borderColor, 0.8);
            plusBg.strokeRoundedRect(0, 0, selW, selH, 6);
        };
        drawPlusBg(0x0d121d, 0.7, 0x1f2b3e);
        plusContainer.add(plusBg);

        const plusText = this.add.text(selW / 2, selH / 2, '+', {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        plusContainer.add(plusText);

        // Interaction for minus/plus
        minusContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, selW, selH), Phaser.Geom.Rectangle.Contains);
        plusContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, selW, selH), Phaser.Geom.Rectangle.Contains);

        minusContainer.on('pointerover', () => drawMinusBg(0x17212e, 0.85, 0x5f7793));
        minusContainer.on('pointerout', () => drawMinusBg(0x0d121d, 0.7, 0x1f2b3e));
        minusContainer.on('pointerdown', () => {
            this.playClick();
            if (this.maxPlayers > 1) {
                this.maxPlayers--;
                this.maxPlayersText.setText(String(this.maxPlayers));
            }
        });

        plusContainer.on('pointerover', () => drawPlusBg(0x17212e, 0.85, 0x5f7793));
        plusContainer.on('pointerout', () => drawPlusBg(0x0d121d, 0.7, 0x1f2b3e));
        plusContainer.on('pointerdown', () => {
            this.playClick();
            if (this.maxPlayers < 10) {
                this.maxPlayers++;
                this.maxPlayersText.setText(String(this.maxPlayers));
            }
        });

        // ── CREATE Button ─────────────────────────────────
        const createW = 180;
        const createH = 50;
        const createContainer = this.add.container(panelRight.x + panelRight.w / 2 - createW / 2, panelRight.y + panelRight.h - 80);
        const createBg = this.add.graphics();
        const drawCreateBg = (color, alpha, borderColor) => {
            createBg.clear();
            createBg.fillStyle(color, alpha);
            createBg.fillRoundedRect(0, 0, createW, createH, 6);
            createBg.lineStyle(1.5, borderColor, 0.8);
            createBg.strokeRoundedRect(0, 0, createW, createH, 6);
        };
        // Use a subtle green-slate color tint for create
        drawCreateBg(0x161f1a, 0.8, 0x2e5c35);
        createContainer.add(createBg);

        const createText = this.add.text(createW / 2, createH / 2, 'CREATE', {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        createContainer.add(createText);

        createContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, createW, createH), Phaser.Geom.Rectangle.Contains);
        
        createContainer.on('pointerover', () => {
            if (createContainer.fadeTween) createContainer.fadeTween.stop();
            createContainer.fadeTween = this.tweens.add({
                targets: createBg,
                alpha: 1,
                duration: 120,
                ease: 'Quad.easeOut',
                onStart: () => drawCreateBg(0x1e3624, 0.9, 0x44ff44)
            });
        });
        
        createContainer.on('pointerout', () => {
            if (createContainer.fadeTween) createContainer.fadeTween.stop();
            createContainer.fadeTween = this.tweens.add({
                targets: createBg,
                alpha: 0.8,
                duration: 200,
                ease: 'Quad.easeOut',
                onStart: () => drawCreateBg(0x161f1a, 0.8, 0x2e5c35)
            });
        });
        
        createContainer.on('pointerdown', () => {
            this.playClick(); 
            this.createServer();
        });

        // ── Refresh Button ────────────────────────────────
        const refW = 160;
        const refH = 40;
        const refreshContainer = this.add.container(panelLeft.x + panelLeft.w / 2 - refW / 2, panelLeft.y + panelLeft.h - 60);
        const refreshBg = this.add.graphics();
        const drawRefreshBg = (color, alpha, borderColor) => {
            refreshBg.clear();
            refreshBg.fillStyle(color, alpha);
            refreshBg.fillRoundedRect(0, 0, refW, refH, 6);
            refreshBg.lineStyle(1.5, borderColor, 0.8);
            refreshBg.strokeRoundedRect(0, 0, refW, refH, 6);
        };
        drawRefreshBg(0x0d121d, 0.7, 0x1f2b3e);
        refreshContainer.add(refreshBg);

        const refreshText = this.add.text(refW / 2, refH / 2, '↻ REFRESH', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        refreshContainer.add(refreshText);

        refreshContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, refW, refH), Phaser.Geom.Rectangle.Contains);
        
        refreshContainer.on('pointerover', () => {
            if (refreshContainer.fadeTween) refreshContainer.fadeTween.stop();
            refreshContainer.fadeTween = this.tweens.add({
                targets: refreshBg,
                alpha: 1,
                duration: 120,
                ease: 'Quad.easeOut',
                onStart: () => drawRefreshBg(0x17212e, 0.85, 0x5f7793)
            });
            refreshText.setColor('#ffffff');
        });
        
        refreshContainer.on('pointerout', () => {
            if (refreshContainer.fadeTween) refreshContainer.fadeTween.stop();
            refreshContainer.fadeTween = this.tweens.add({
                targets: refreshBg,
                alpha: 0.7,
                duration: 200,
                ease: 'Quad.easeOut',
                onStart: () => drawRefreshBg(0x0d121d, 0.7, 0x1f2b3e)
            });
            refreshText.setColor('#7fa3c7');
        });
        
        refreshContainer.on('pointerdown', () => {
            this.requestServerList();
            this.playClick(); 
        });

        // ─── Connect using SocketManager ──────────────────
        this.connectToLobby();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  SOCKET CONNECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    connectToLobby() {
        // Use SocketManager — it reuses the connection if already open
        const socket = SocketManager.connect();

        // Remove old lobby listeners before adding new ones
        socket.off('serverList');
        socket.off('serverCreated');
        socket.off('joinedServer');
        socket.off('lobbyError');

        socket.on('serverList', (servers) => {
            this.serverList = servers;
            this.renderServerList();
        });

        socket.on('serverCreated', (serverData) => {
            SocketManager.setRoom(serverData.roomId);

            // ✅ Clean lobby listeners before switching scene
            this.cleanup();

            this.scene.start('GameScene', {
                mode: 'multiplayer',
                roomId: serverData.roomId,
                character: this.selectedCharacter
            });
        });

        socket.on('joinedServer', (serverData) => {
            SocketManager.setRoom(serverData.roomId);

            // ✅ Clean lobby listeners before switching scene
            this.cleanup();

            this.scene.start('GameScene', {
                mode: 'multiplayer',
                roomId: serverData.roomId,
                character: this.selectedCharacter
            });
        });

        socket.on('lobbyError', (msg) => {
            console.warn('⚠️ Lobby error:', msg);
            alert(msg);
        });

        // Request list immediately
        this.requestServerList();
    }

    requestServerList() {
        const socket = SocketManager.get();
        if (!socket || !socket.connected) return;

        if (this.loadingText) {
            this.loadingText.setText('Refreshing...');
            this.loadingText.setVisible(true);
        }

        socket.emit('getServers');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  RENDER SERVER LIST
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    renderServerList() {
        this.serverListElements.forEach(el => el.destroy());
        this.serverListElements = [];

        const { x, startY, w, rowH } = this.listConfig;

        if (this.loadingText) this.loadingText.setVisible(false);

        if (!this.serverList || this.serverList.length === 0) {
            const noServers = this.add.text(
                x + w / 2,
                startY + 60,
                'No servers found.\nCreate one!',
                {
                    fontFamily: 'Rajdhani',
                    fontSize: '18px',
                    color: '#7fa3c7',
                    align: 'center'
                }
            ).setOrigin(0.5);
            this.serverListElements.push(noServers);
            return;
        }

        this.serverList.forEach((server, index) => {
            const rowY = startY + index * rowH;

            // Row background using Graphics
            const rowBg = this.add.graphics();
            const drawRow = (color, alpha, borderColor) => {
                rowBg.clear();
                rowBg.fillStyle(color, alpha);
                rowBg.fillRoundedRect(x + 10, rowY, w - 20, rowH - 4, 6);
                rowBg.lineStyle(1.5, borderColor, 0.8);
                rowBg.strokeRoundedRect(x + 10, rowY, w - 20, rowH - 4, 6);
            };
            drawRow(0x0d121d, 0.5, 0x1f2b3e);

            const nameText = this.add.text(
                x + 25, rowY + 12,
                server.name || 'Unnamed',
                {
                    fontFamily: 'Rajdhani',
                    fontSize: '16px',
                    color: '#ffffff'
                }
            );

            const isFull = server.players >= server.maxPlayers;

            const playersText = this.add.text(
                x + w * 0.5, rowY + 12,
                `${server.players}/${server.maxPlayers}`,
                {
                    fontFamily: 'Rajdhani',
                    fontSize: '16px',
                    color: isFull ? '#ff4444' : '#7fa3c7'
                }
            );

            const statusText = this.add.text(
                x + w * 0.75, rowY + 12,
                isFull ? 'FULL' : 'OPEN',
                {
                    fontFamily: 'Rajdhani',
                    fontSize: '16px',
                    color: isFull ? '#ff4444' : '#7fa3c7'
                }
            );

            // Invisible hit area for interactive behavior
            const hitArea = this.add.rectangle(x + w / 2, rowY + (rowH - 4) / 2, w - 20, rowH - 4, 0x000000, 0)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            hitArea.on('pointerover', () => {
                drawRow(0x17212e, 0.8, 0x5f7793);
            });

            hitArea.on('pointerout', () => {
                drawRow(0x0d121d, 0.5, 0x1f2b3e);
            });

            hitArea.on('pointerdown', () => {
                this.playClick(); 
                if (isFull) {
                    alert('Server is full!');
                    return;
                }
                this.joinServer(server.roomId);
            });

            this.serverListElements.push(rowBg, nameText, playersText, statusText, hitArea);
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ACTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    createServer() {
        this.pickedColorsInRoom = [];
        this.tempAlias = PlayerData.alias;
        this.selectedColorId = PlayerData.color;
        this.pendingCreate = true;
        this.pendingJoinRoomId = null;
        this.showIdentityModal();
    }

    joinServer(roomId) {
        const server = this.serverList.find(s => s.roomId === roomId);
        this.pickedColorsInRoom = server ? (server.pickedColors || []) : [];
        
        this.tempAlias = PlayerData.alias;
        
        // Auto-select a color that is not already picked in this room
        let availColorId = PlayerData.color;
        const colors = PlayerData.colors;
        if (this.pickedColorsInRoom.includes(availColorId)) {
            const found = colors.find(c => !this.pickedColorsInRoom.includes(c.id));
            if (found) {
                availColorId = found.id;
            }
        }
        this.selectedColorId = availColorId;

        this.pendingCreate = false;
        this.pendingJoinRoomId = roomId;
        this.showIdentityModal();
    }

    executeCreateServer() {
        const socket = SocketManager.get();

        if (!socket || !socket.connected) {
            alert('Not connected to server!');
            return;
        }

        socket.emit('createServer', {
            name: this.serverNameValue,
            maxPlayers: this.maxPlayers,
            character: this.selectedCharacter,
            alias: PlayerData.alias,
            color: PlayerData.color
        });
    }

    executeJoinServer(roomId) {
        const socket = SocketManager.get();

        if (!socket || !socket.connected) {
            alert('Not connected to server!');
            return;
        }

        socket.emit('joinServer', {
            roomId,
            character: this.selectedCharacter,
            alias: PlayerData.alias,
            color: PlayerData.color
        });
    }

    showIdentityModal() {
        if (!this.identityModalContainer) {
            this.identityModalContainer = this.add.container(0, 0);
        }
        this.identityModalContainer.removeAll(true);
        this.identityModalContainer.setVisible(true);

        const { width, height } = this.scale;

        // Semi-transparent overlay blocker
        const blocker = this.add.rectangle(0, 0, width, height, 0x000000, 0.6)
            .setOrigin(0)
            .setInteractive();
        this.identityModalContainer.add(blocker);

        const modalW = 500;
        const modalH = 420;
        const modalX = width / 2 - modalW / 2;
        const modalY = height / 2 - modalH / 2;

        const modalBg = this.add.graphics();
        modalBg.fillStyle(0x0d121d, 0.95);
        modalBg.fillRoundedRect(modalX, modalY, modalW, modalH, 12);
        modalBg.lineStyle(2, 0x1f2b3e, 1);
        modalBg.strokeRoundedRect(modalX, modalY, modalW, modalH, 12);
        this.identityModalContainer.add(modalBg);

        // Title
        const titleText = this.add.text(width / 2, modalY + 30, 'CHOOSE YOUR IDENTITY', {
            fontFamily: 'Rajdhani',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.identityModalContainer.add(titleText);

        // Alias Label
        const aliasLabel = this.add.text(width / 2, modalY + 75, 'ALIAS', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        this.identityModalContainer.add(aliasLabel);

        // Alias Input Button Field
        const aliasBtnW = 340;
        const aliasBtnH = 40;
        const aliasBtnContainer = this.add.container(width / 2 - aliasBtnW / 2, modalY + 95);
        const aliasBtnBg = this.add.graphics();
        const drawAliasBg = (color, alpha, borderColor) => {
            aliasBtnBg.clear();
            aliasBtnBg.fillStyle(color, alpha);
            aliasBtnBg.fillRoundedRect(0, 0, aliasBtnW, aliasBtnH, 6);
            aliasBtnBg.lineStyle(1.5, borderColor, 0.8);
            aliasBtnBg.strokeRoundedRect(0, 0, aliasBtnW, aliasBtnH, 6);
        };
        drawAliasBg(0x0d121d, 0.7, 0x1f2b3e);
        aliasBtnContainer.add(aliasBtnBg);

        const aliasText = this.add.text(aliasBtnW / 2, aliasBtnH / 2, this.tempAlias, {
            fontFamily: 'Rajdhani',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        aliasBtnContainer.add(aliasText);

        aliasBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, aliasBtnW, aliasBtnH), Phaser.Geom.Rectangle.Contains);
        aliasBtnContainer.on('pointerover', () => drawAliasBg(0x17212e, 0.85, 0x5f7793));
        aliasBtnContainer.on('pointerout', () => drawAliasBg(0x0d121d, 0.7, 0x1f2b3e));
        aliasBtnContainer.on('pointerdown', () => {
            this.playClick();
            const name = prompt('Enter your alias:', this.tempAlias);
            if (name && name.trim().length > 0) {
                this.tempAlias = name.trim().substring(0, 15);
                aliasText.setText(this.tempAlias);
            }
        });
        this.identityModalContainer.add(aliasBtnContainer);

        // Color Label
        const colorLabel = this.add.text(width / 2, modalY + 160, 'PLAYER COLOR', {
            fontFamily: 'Rajdhani',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#7fa3c7'
        }).setOrigin(0.5);
        this.identityModalContainer.add(colorLabel);

        // Color Grid (8 columns x 3 rows)
        const colors = PlayerData.colors;
        const circleRadius = 16; // 32px diameter
        const gap = 10;
        const swatchW = circleRadius * 2;
        const swatchH = circleRadius * 2;
        
        // Total grid width for 8 columns
        const totalGridW = 8 * swatchW + 7 * gap;
        const startX = width / 2 - totalGridW / 2 + circleRadius;
        const swatchStartY = modalY + 185;

        const swatchGraphicsList = [];

        const drawSwatches = () => {
            swatchGraphicsList.forEach(g => g.destroy());
            swatchGraphicsList.length = 0;

            colors.forEach((c, idx) => {
                const col = idx % 8;
                const row = Math.floor(idx / 8);
                const cx = startX + col * (swatchW + gap);
                const cy = swatchStartY + row * (swatchH + gap);
                
                const isSelected = this.selectedColorId === c.id;
                const isPicked = this.pickedColorsInRoom && this.pickedColorsInRoom.includes(c.id);

                const swatchContainer = this.add.container(cx, cy);
                const swatchBg = this.add.graphics();
                const tintColor = c.tint !== null ? c.tint : 0x78899a;
                
                swatchBg.fillStyle(tintColor, isPicked ? 0.25 : 1);
                swatchBg.fillCircle(0, 0, circleRadius);

                // Thick dark stroke around the circle (Among Us style)
                swatchBg.lineStyle(2.5, 0x090a0b, isPicked ? 0.3 : 1);
                swatchBg.strokeCircle(0, 0, circleRadius);

                if (isPicked) {
                    // Draw a red diagonal cross / "X" over the color swatch
                    const lineG = this.add.graphics();
                    lineG.lineStyle(2.5, 0xef4444, 0.85);
                    const size = circleRadius - 4;
                    lineG.lineBetween(-size, -size, size, size);
                    lineG.lineBetween(size, -size, -size, size);
                    swatchContainer.add(lineG);
                } else if (isSelected) {
                    // Inner white border
                    swatchBg.lineStyle(3, 0xffffff, 1);
                    swatchBg.strokeCircle(0, 0, circleRadius + 4);
                    // Glowing outer circle
                    swatchBg.lineStyle(1.5, 0x00ffff, 0.85);
                    swatchBg.strokeCircle(0, 0, circleRadius + 7);
                }

                swatchContainer.add(swatchBg);
                
                // Touch/click detection (only if color is not already picked)
                if (!isPicked) {
                    swatchContainer.setInteractive(new Phaser.Geom.Circle(0, 0, circleRadius + 6), Phaser.Geom.Circle.Contains);
                    swatchContainer.on('pointerover', () => {
                        if (!isSelected) {
                            swatchBg.lineStyle(1.5, 0xffffff, 0.6);
                            swatchBg.strokeCircle(0, 0, circleRadius + 4);
                        }
                    });
                    swatchContainer.on('pointerout', () => {
                        if (!isSelected) {
                            swatchBg.clear();
                            swatchBg.fillStyle(tintColor, 1);
                            swatchBg.fillCircle(0, 0, circleRadius);
                            swatchBg.lineStyle(2.5, 0x090a0b, 1);
                            swatchBg.strokeCircle(0, 0, circleRadius);
                        }
                    });
                    swatchContainer.on('pointerdown', () => {
                        this.playClick();
                        this.selectedColorId = c.id;
                        drawSwatches();
                    });
                }

                this.identityModalContainer.add(swatchContainer);
                swatchGraphicsList.push(swatchContainer);
            });
        };

        drawSwatches();

        // Buttons (Cancel & Join/Launch)
        const btnW = 140;
        const btnH = 40;
        
        // Cancel Button
        const cancelBtnContainer = this.add.container(width / 2 - 90 - btnW / 2, modalY + 345);
        const cancelBg = this.add.graphics();
        const drawCancelBg = (color, alpha, borderColor) => {
            cancelBg.clear();
            cancelBg.fillStyle(color, alpha);
            cancelBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            cancelBg.lineStyle(1.5, borderColor, 0.8);
            cancelBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
        };
        drawCancelBg(0x3f1a1a, 0.7, 0x882222);
        cancelBtnContainer.add(cancelBg);

        const cancelText = this.add.text(btnW / 2, btnH / 2, 'CANCEL', {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ff8888'
        }).setOrigin(0.5);
        cancelBtnContainer.add(cancelText);

        cancelBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        cancelBtnContainer.on('pointerover', () => {
            drawCancelBg(0x5a1f1f, 0.9, 0xff4444);
            cancelText.setColor('#ffffff');
        });
        cancelBtnContainer.on('pointerout', () => {
            drawCancelBg(0x3f1a1a, 0.7, 0x882222);
            cancelText.setColor('#ff8888');
        });
        cancelBtnContainer.on('pointerdown', () => {
            this.playClick();
            this.identityModalContainer.setVisible(false);
        });
        this.identityModalContainer.add(cancelBtnContainer);

        // Join / Launch Button
        const joinBtnContainer = this.add.container(width / 2 + 90 - btnW / 2, modalY + 345);
        const joinBg = this.add.graphics();
        const drawJoinBg = (color, alpha, borderColor) => {
            joinBg.clear();
            joinBg.fillStyle(color, alpha);
            joinBg.fillRoundedRect(0, 0, btnW, btnH, 6);
            joinBg.lineStyle(1.5, borderColor, 0.8);
            joinBg.strokeRoundedRect(0, 0, btnW, btnH, 6);
        };
        drawJoinBg(0x161f1a, 0.8, 0x2e5c35);
        joinBtnContainer.add(joinBg);

        const actionTextStr = this.pendingCreate ? 'LAUNCH' : 'JOIN';
        const joinText = this.add.text(btnW / 2, btnH / 2, actionTextStr, {
            fontFamily: 'Rajdhani',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        joinBtnContainer.add(joinText);

        joinBtnContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnW, btnH), Phaser.Geom.Rectangle.Contains);
        joinBtnContainer.on('pointerover', () => {
            drawJoinBg(0x1e3624, 0.9, 0x44ff44);
        });
        joinBtnContainer.on('pointerout', () => {
            drawJoinBg(0x161f1a, 0.8, 0x2e5c35);
        });
        joinBtnContainer.on('pointerdown', () => {
            this.playClick();
            
            // Save to PlayerData so it persists
            PlayerData.setAlias(this.tempAlias);
            PlayerData.setColor(this.selectedColorId);

            // Execute the action
            if (this.pendingCreate) {
                this.executeCreateServer();
            } else {
                this.executeJoinServer(this.pendingJoinRoomId);
            }

            this.identityModalContainer.setVisible(false);
        });
        this.identityModalContainer.add(joinBtnContainer);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  CLEANUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    cleanup() {
        const socket = SocketManager.get();
        if (socket) {
            socket.off('serverList');
            socket.off('serverCreated');
            socket.off('joinedServer');
            socket.off('lobbyError');
        }

        this.serverList = [];
        this.serverListElements = [];

        if (this.identityModalContainer) {
            this.identityModalContainer.destroy();
            this.identityModalContainer = null;
        }
    }
}
