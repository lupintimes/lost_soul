const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let rooms = {};

const SPAWN_POINTS = [
    // Original starting spawn points
    { x: 300, y: 3669 },
    { x: 600, y: 3669 },
    { x: 900, y: 3669 },
    { x: 1200, y: 3669 },
    { x: 1500, y: 3669 },
    { x: 550, y: 3263 },
    { x: 800, y: 3263 },
    { x: 1350, y: 3261 },
    { x: 1550, y: 3261 },
    { x: 1050, y: 3053 },

    // Middle ground & platforms
    { x: 1800, y: 3757 },
    { x: 2100, y: 3757 },
    { x: 2400, y: 3757 },
    { x: 300, y: 2448 },
    { x: 800, y: 2448 },
    { x: 1300, y: 2448 },
    { x: 1800, y: 2448 },
    { x: 2700, y: 2744 },
    { x: 3100, y: 2744 },
    { x: 3500, y: 2744 },

    // Right side ground & platforms
    { x: 4000, y: 3781 },
    { x: 4300, y: 3781 },
    { x: 4600, y: 3781 },
    { x: 5000, y: 3781 },
    { x: 5300, y: 3781 },
    { x: 4900, y: 3596 },
    { x: 5300, y: 3596 },
    { x: 5700, y: 3596 },

    // High altitude platforms
    { x: 4000, y: 2224 },
    { x: 4400, y: 2224 },
    { x: 4700, y: 2224 },
    { x: 4700, y: 1910 },
    { x: 5000, y: 1910 },
    { x: 4800, y: 792 },
    { x: 5100, y: 792 },
    { x: 5600, y: 792 },
    { x: 5800, y: 792 },

    // User-defined additional spawn positions
    { x: 150, y: 200 },
    { x: 230, y: 1000 },
    { x: 2050, y: 975 },
    { x: 3350, y: 270 },
    { x: 5060, y: 1200 },
    { x: 2700, y: 2650 },
    { x: 2880, y: 1240 },
    { x: 300, y: 2275 },
    { x: 1200, y: 2350 },
    { x: 2300, y: 2060 },
    { x: 4050, y: 2050 },
    { x: 4125, y: 3085 },
    { x: 5445, y: 3575 },
    { x: 5300, y: 2850 }
];

function getUniqueSpawn(room) {
    const usedPositions = Object.values(room.players).map(p => ({ x: p.x, y: p.y }));

    const available = SPAWN_POINTS.filter(sp => {
        return !usedPositions.some(used =>
            Math.abs(used.x - sp.x) < 80 && Math.abs(used.y - sp.y) < 80
        );
    });

    if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
    }

    return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

io.on('connection', (socket) => {
    console.log('✅ A user connected: ' + socket.id);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  LOBBY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on('getServers', () => {
        const list = Object.values(rooms).map(room => ({
            roomId: room.roomId,
            name: room.name,
            players: Object.keys(room.players).length,
            maxPlayers: room.maxPlayers
        }));
        socket.emit('serverList', list);
    });

    socket.on('createServer', (data) => {
        leaveCurrentRoom(socket);

        const roomId = 'room_' + Math.random().toString(36).substring(2, 9);

        let maxPlayers = parseInt(data.maxPlayers) || 4;
        maxPlayers = Math.max(1, Math.min(10, maxPlayers));

        rooms[roomId] = {
            roomId,
            name: data.name || 'Unnamed Server',
            maxPlayers,
            players: {},
            hostId: socket.id,
            obstacles: {}
        };

        const spawn = getUniqueSpawn(rooms[roomId]);

        const pChar = data.character || 'p1';
        const startHealth = pChar === 'p1' ? 130 : 100;

        rooms[roomId].players[socket.id] = {
            playerId: socket.id,
            x: spawn.x,
            y: spawn.y,
            flipX: false,
            anim: 'idle_anim',
            health: startHealth,
            kills: 0,
            deaths: 0,
            character: pChar,
            color: data.color || 'slate',
            alias: data.alias || 'Host_' + socket.id.substring(0, 4),
            state: 'idle',
            isInvincible: true
        };

        socket.join(roomId);
        socket.roomId = roomId;

        console.log(`🏠 Room created: ${roomId} | Spawn: (${spawn.x}, ${spawn.y})`);

        socket.emit('serverCreated', { roomId, name: rooms[roomId].name });

        // ✅ FIX: Store in local variables for timeout
        const createdRoomId = roomId;
        const createdSocketId = socket.id;

        setTimeout(() => {
            if (rooms[createdRoomId] && rooms[createdRoomId].players[createdSocketId]) {
                rooms[createdRoomId].players[createdSocketId].isInvincible = false;
                console.log(`🛡️ Invincibility ended for ${createdSocketId}`);
            }
        }, 5000);

        broadcastServerList();
    });

    socket.on('joinServer', (data) => {
        const room = rooms[data.roomId];

        if (!room) {
            socket.emit('lobbyError', 'Room not found!');
            return;
        }

        const currentCount = Object.keys(room.players).length;

        if (currentCount >= room.maxPlayers) {
            socket.emit('lobbyError', 'Room is full!');
            return;
        }

        leaveCurrentRoom(socket);

        const spawn = getUniqueSpawn(room);

        const pChar = data.character || 'p1';
        const startHealth = pChar === 'p1' ? 130 : 100;

        const playerObj = {
            playerId: socket.id,
            x: spawn.x,
            y: spawn.y,
            flipX: false,
            anim: 'idle_anim',
            health: startHealth,
            kills: 0,
            deaths: 0,
            character: pChar,
            color: data.color || 'slate',
            alias: data.alias || 'Guest_' + socket.id.substring(0, 4),
            state: 'idle',
            isInvincible: true
        };

        room.players[socket.id] = playerObj;
        socket.join(data.roomId);
        socket.roomId = data.roomId;

        console.log(`🎮 ${socket.id} joined: ${data.roomId} (${Object.keys(room.players).length}/${room.maxPlayers})`);

        socket.emit('joinedServer', { roomId: data.roomId, name: room.name });
        socket.to(data.roomId).emit('newPlayer', playerObj);

        // ✅ FIX: Store roomId in a variable for the timeout
        const joinedRoomId = data.roomId;
        const joinedSocketId = socket.id;

        setTimeout(() => {
            if (rooms[joinedRoomId] && rooms[joinedRoomId].players[joinedSocketId]) {
                rooms[joinedRoomId].players[joinedSocketId].isInvincible = false;
                console.log(`🛡️ Invincibility ended for ${joinedSocketId}`);
            }
        }, 5000);

        broadcastServerList();
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  ✅ REQUEST PLAYERS — GameScene calls this when ready
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on('requestPlayers', () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) {
            console.warn(`⚠️ requestPlayers: ${socket.id} not in any room`);
            return;
        }

        // ✅ Log exactly what we're sending
        const playersData = rooms[roomId].players;
        console.log(`📋 Sending players to ${socket.id}:`, Object.keys(playersData));
        console.log(`📋 Full data:`, JSON.stringify(playersData));

        // ✅ Send the FULL object with all player data
        socket.emit('currentPlayers', playersData);

        // Send existing obstacles to the joining player
        if (rooms[roomId].obstacles) {
            socket.emit('currentObstacles', rooms[roomId].obstacles);
        }
    });

    socket.on('createObstacle', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (!rooms[roomId].obstacles) {
            rooms[roomId].obstacles = {};
        }

        const creatorId = data.creatorId || socket.id;

        // Calculate total area currently used by this player on the server
        let usedArea = 0;
        Object.values(rooms[roomId].obstacles).forEach(obs => {
            if (obs.creatorId === creatorId) {
                usedArea += obs.rect.w * obs.rect.h;
            }
        });

        const newArea = data.rect.w * data.rect.h;
        const MAX_BUILD_POINTS = 300000;

        // Enforce the limit only if the player is creating their own obstacle
        if (creatorId === socket.id && (usedArea + newArea) > MAX_BUILD_POINTS) {
            console.warn(`⚠️ Blocked createObstacle from ${socket.id}: Build points budget exceeded (${usedArea + newArea} > ${MAX_BUILD_POINTS})`);
            return;
        }

        rooms[roomId].obstacles[data.id] = {
            id: data.id,
            rect: data.rect,
            opacity: data.opacity,
            creatorId: creatorId,
            tint: data.tint,
            blockType: data.blockType || 'normal',
            createdAt: data.createdAt || Date.now()
        };

        data.creatorId = creatorId;
        data.createdAt = rooms[roomId].obstacles[data.id].createdAt;
        socket.to(roomId).emit('obstacleCreated', data);

        // Server-side authoritative decay countdown (15 seconds)
        const obstacleId = data.id;
        const decayTime = 15000;
        setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].obstacles && rooms[roomId].obstacles[obstacleId]) {
                delete rooms[roomId].obstacles[obstacleId];
                io.to(roomId).emit('obstacleRemoved', { id: obstacleId });
                console.log(`🗑️ Server decay: authoritatively removed obstacle ${obstacleId} in room ${roomId}`);
            }
        }, decayTime);
    });

    socket.on('removeObstacle', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        if (rooms[roomId].obstacles && rooms[roomId].obstacles[data.id]) {
            delete rooms[roomId].obstacles[data.id];
            socket.to(roomId).emit('obstacleRemoved', data);
        }
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  IN-GAME
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on('playerMovement', (movementData) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId] || !rooms[roomId].players[socket.id]) return;

        const player = rooms[roomId].players[socket.id];
        player.x = movementData.x;
        player.y = movementData.y;
        player.flipX = movementData.flipX;
        player.anim = movementData.anim;
        player.isShieldActive = movementData.isShieldActive || false;
        player.isRageActive = movementData.isRageActive || false;
        player.state = movementData.state || 'idle';
        if (movementData.health !== undefined) {
            player.health = movementData.health;
        }

        // ✅ No console.log here — it slows down the server
        socket.to(roomId).emit('playerMoved', player);
    });

    socket.on('playerAttack', (attackData) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const attacker = room.players[socket.id];
        const target = room.players[attackData.targetId];

        if (!attacker || !target) return;
        if (target.health <= 0) return;

        // ✅ Block damage if target is invincible
        if (target.isInvincible) return;

        let damage = attackData.damage || 10;
        // Knight Shield Block damage reduction (100% reduction - no damage)
        if (target.isShieldActive) {
            damage = 0;
            target.shieldBlocksAbsorbed = (target.shieldBlocksAbsorbed || 0) + 1;
        }
        target.health = Math.max(0, target.health - damage);

        console.log(`⚔️ ${socket.id} hit ${attackData.targetId} for ${damage} dmg (HP: ${target.health})`);

        io.to(roomId).emit('playerDamaged', {
            attackerId: socket.id,
            targetId: attackData.targetId,
            damage: damage,
            remainingHealth: target.health
        });

        if (target.health <= 0) {
            attacker.kills++;
            target.deaths++;

            console.log(`💀 ${attackData.targetId} killed by ${socket.id}`);

            io.to(roomId).emit('playerKilled', {
                killerId: socket.id,
                victimId: attackData.targetId,
                killerKills: attacker.kills,
                victimDeaths: target.deaths
            });

            // In playerAttack handler, the respawn section:
            setTimeout(() => {
                if (rooms[roomId] && rooms[roomId].players[attackData.targetId]) {
                    const respawnPoint = getUniqueSpawn(room);
                    const maxHealth = target.character === 'p1' ? 130 : 100;
                    target.health = maxHealth;
                    target.x = respawnPoint.x;
                    target.y = respawnPoint.y;
                    target.isInvincible = true;

                    // ✅ FIX: Store in local variables
                    const respawnRoomId = roomId;
                    const respawnPlayerId = attackData.targetId;

                    setTimeout(() => {
                        if (rooms[respawnRoomId] && rooms[respawnRoomId].players[respawnPlayerId]) {
                            rooms[respawnRoomId].players[respawnPlayerId].isInvincible = false;
                            console.log(`🛡️ Invincibility ended for ${respawnPlayerId}`);
                        }
                    }, 5000);

                    io.to(roomId).emit('playerRespawned', {
                        playerId: attackData.targetId,
                        x: respawnPoint.x,
                        y: respawnPoint.y,
                        health: maxHealth
                    });
                }
            }, 3000);
        }
    });

    socket.on('getScoreboard', () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const scoreboard = Object.values(rooms[roomId].players).map(p => ({
            playerId: p.playerId,
            alias: p.alias,
            kills: p.kills,
            deaths: p.deaths,
            health: p.health
        }));

        scoreboard.sort((a, b) => b.kills - a.kills);
        socket.emit('scoreboard', scoreboard);
    });

    socket.on('castSpell', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        socket.to(roomId).emit('spellCast', {
            casterId: socket.id,
            x: data.x,
            y: data.y,
            dir: data.dir,
            character: data.character,
            spellId: data.spellId,
            type: data.type
        });

        if (data.type === 'shield_block') {
            const room = rooms[roomId];
            const player = room.players[socket.id];
            if (player) {
                player.isShieldActive = true;
                player.shieldBlocksAbsorbed = 0;
                player.shieldSpellId = data.spellId;

                if (player.shieldTimeout) {
                    clearTimeout(player.shieldTimeout);
                }

                player.shieldTimeout = setTimeout(() => {
                    if (rooms[roomId] && rooms[roomId].players[socket.id] && player.isShieldActive) {
                        console.log(`🛡️ Server fallback: releasing shield blast for ${socket.id}`);
                        player.isShieldActive = false;
                        
                        io.to(roomId).emit('shieldBlastReleased', {
                            casterId: socket.id,
                            blocksAbsorbed: player.shieldBlocksAbsorbed,
                            blastId: `${data.spellId}_blast`
                        });
                    }
                }, 2200);
            }
        }
    });

    socket.on('releaseShieldBlast', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const player = room.players[socket.id];
        if (player) {
            player.isShieldActive = false;
            if (player.shieldTimeout) {
                clearTimeout(player.shieldTimeout);
                player.shieldTimeout = null;
            }
            const blocks = Math.max(player.shieldBlocksAbsorbed || 0, data.blocksAbsorbed || 0);

            socket.to(roomId).emit('shieldBlastReleased', {
                casterId: socket.id,
                blocksAbsorbed: blocks,
                blastId: data.blastId || `${socket.id}_blast_${Date.now()}`
            });
        }
    });

    socket.on('spellHit', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        if (!room.spentSpells) {
            room.spentSpells = new Set();
        }

        const spellId = data.spellId;
        if (room.spentSpells.has(spellId)) {
            return;
        }
        room.spentSpells.add(spellId);

        const target = room.players[data.targetId];
        const casterId = spellId ? spellId.split('_spell_')[0] : null;
        const caster = room.players[casterId];

        if (!target) return;
        if (target.health <= 0) return;

        if (target.isInvincible) return;

        let damage = data.damage || 10;
        if (target.isShieldActive) {
            damage = 0;
        }
        target.health = Math.max(0, target.health - damage);

        console.log(`🔮 Spell Hit: ${casterId} hit ${data.targetId} with spell ${spellId} for ${damage} dmg (HP: ${target.health})`);

        io.to(roomId).emit('playerDamaged', {
            attackerId: casterId,
            targetId: data.targetId,
            damage: damage,
            remainingHealth: target.health
        });

        if (target.health <= 0) {
            if (caster) {
                caster.kills++;
            }
            target.deaths++;

            console.log(`💀 ${data.targetId} killed by ${casterId} via spell`);

            io.to(roomId).emit('playerKilled', {
                killerId: casterId,
                victimId: data.targetId,
                killerKills: caster ? caster.kills : 0,
                victimDeaths: target.deaths
            });

            // Respawn timeout
            setTimeout(() => {
                if (rooms[roomId] && rooms[roomId].players[data.targetId]) {
                    const respawnPoint = getUniqueSpawn(room);
                    const maxHealth = target.character === 'p1' ? 130 : 100;
                    target.health = maxHealth;
                    target.x = respawnPoint.x;
                    target.y = respawnPoint.y;
                    target.isInvincible = true;

                    const respawnRoomId = roomId;
                    const respawnPlayerId = data.targetId;

                    setTimeout(() => {
                        if (rooms[respawnRoomId] && rooms[respawnRoomId].players[respawnPlayerId]) {
                            rooms[respawnRoomId].players[respawnPlayerId].isInvincible = false;
                            console.log(`🛡️ Invincibility ended for ${respawnPlayerId}`);
                        }
                    }, 5000);

                    io.to(roomId).emit('playerRespawned', {
                        playerId: data.targetId,
                        x: respawnPoint.x,
                        y: respawnPoint.y,
                        health: maxHealth
                    });
                }
            }, 3000);
        }
    });

    socket.on('shieldBlastHit', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        if (!room.spentBlasts) {
            room.spentBlasts = new Set();
        }

        const blastId = data.blastId;
        if (room.spentBlasts.has(blastId)) {
            return;
        }
        room.spentBlasts.add(blastId);

        const target = room.players[data.targetId];
        const casterId = blastId ? blastId.split('_shield_')[0] : null;
        const caster = room.players[casterId];

        if (!target) return;
        if (target.health <= 0) return;
        if (target.isInvincible) return;

        let damage = data.damage || 15;
        if (target.isShieldActive) {
            damage = 0;
        }
        target.health = Math.max(0, target.health - damage);

        console.log(`💥 Shield Blast Hit: ${casterId} hit ${data.targetId} with blast ${blastId} for ${damage} dmg (HP: ${target.health})`);

        io.to(roomId).emit('playerDamaged', {
            attackerId: casterId,
            targetId: data.targetId,
            damage: damage,
            remainingHealth: target.health
        });

        if (target.health <= 0) {
            if (caster) {
                caster.kills++;
            }
            target.deaths++;

            console.log(`💀 ${data.targetId} killed by ${casterId} via shield blast`);

            io.to(roomId).emit('playerKilled', {
                killerId: casterId,
                victimId: data.targetId,
                killerKills: caster ? caster.kills : 0,
                victimDeaths: target.deaths
            });

            // Respawn timeout
            setTimeout(() => {
                if (rooms[roomId] && rooms[roomId].players[data.targetId]) {
                    const respawnPoint = getUniqueSpawn(room);
                    const maxHealth = target.character === 'p1' ? 130 : 100;
                    target.health = maxHealth;
                    target.x = respawnPoint.x;
                    target.y = respawnPoint.y;
                    target.isInvincible = true;

                    const respawnRoomId = roomId;
                    const respawnPlayerId = data.targetId;

                    setTimeout(() => {
                        if (rooms[respawnRoomId] && rooms[respawnRoomId].players[respawnPlayerId]) {
                            rooms[respawnRoomId].players[respawnPlayerId].isInvincible = false;
                            console.log(`🛡️ Invincibility ended for ${respawnPlayerId}`);
                        }
                    }, 5000);

                    io.to(roomId).emit('playerRespawned', {
                        playerId: data.targetId,
                        x: respawnPoint.x,
                        y: respawnPoint.y,
                        health: maxHealth
                    });
                }
            }, 3000);
        }
    });

    socket.on('chatMessage', (data) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId]) return;

        socket.to(roomId).emit('chatMessage', {
            senderId: socket.id,
            message: data.message
        });
    });

    socket.on('leaveRoom', () => {
        leaveCurrentRoom(socket);
        broadcastServerList();
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  DISCONNECT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on('disconnect', () => {
        console.log('❌ User disconnected: ' + socket.id);
        leaveCurrentRoom(socket);
        broadcastServerList();
    });
});

function leaveCurrentRoom(socket) {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

    // Remove client obstacles first
    if (room.obstacles) {
        Object.keys(room.obstacles).forEach(obsId => {
            const obs = room.obstacles[obsId];
            if (obs && obs.creatorId === socket.id) {
                delete room.obstacles[obsId];
                socket.to(roomId).emit('obstacleRemoved', { id: obsId });
            }
        });
    }

    delete room.players[socket.id];
    socket.to(roomId).emit('disconnectUser', socket.id);
    socket.leave(roomId);
    socket.roomId = null;

    const remaining = Object.keys(room.players).length;
    console.log(`🚪 ${socket.id} left room: ${roomId} (${remaining} remaining)`);

    if (remaining <= 0) {
        console.log(`🗑️ Room deleted: ${roomId}`);
        delete rooms[roomId];
    } else {
        if (room.hostId === socket.id) {
            room.hostId = Object.keys(room.players)[0];
            console.log(`👑 New host: ${room.hostId}`);
        }

        const scoreboard = Object.values(room.players).map(p => ({
            playerId: p.playerId,
            alias: p.alias,
            kills: p.kills,
            deaths: p.deaths,
            health: p.health
        }));
        scoreboard.sort((a, b) => b.kills - a.kills);
        io.to(roomId).emit('scoreboard', scoreboard);
    }
}

function broadcastServerList() {
    const list = Object.values(rooms).map(room => ({
        roomId: room.roomId,
        name: room.name,
        players: Object.keys(room.players).length,
        maxPlayers: room.maxPlayers
    }));
    io.emit('serverList', list);
}

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
    console.log(`🚀 Listening on port ${PORT}`);
});