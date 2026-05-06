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

// ─── In-memory storage ──────────────────────────────
let rooms = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🎯 SPAWN POINTS — MUST MATCH CLIENT PLATFORMS!
//  These are placed ON TOP of your colliders so players
//  land on solid ground, not in the void.
//
//  Your colliders:
//    Ground:   { x: 0,    y: 3747, w: 6000, h: 251 }  → surface y = 3747
//    Platform: { x: 414,  y: 3341, w: 814,  h: 68  }  → surface y = 3341
//    Platform: { x: 1216, y: 3339, w: 544,  h: 70  }  → surface y = 3339
//    Platform: { x: 916,  y: 3131, w: 582,  h: 22  }  → surface y = 3131
//    Platform: { x: 1167, y: 3048, w: 281,  h: 17  }  → surface y = 3048
//
//  Player sprite is ~420px tall, scaled down. The sprite
//  origin is 0.5, so we subtract ~50px from surface y
//  to land feet on the platform.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SPAWN_POINTS = [
    // On the ground (y: 3747 surface)
    { x: 300,  y: 3700 },
    { x: 600,  y: 3700 },
    { x: 900,  y: 3700 },
    { x: 1200, y: 3700 },
    { x: 1500, y: 3700 },

    // On platform (y: 3341 surface)
    { x: 550,  y: 3290 },
    { x: 800,  y: 3290 },
    { x: 1050, y: 3290 },

    // On platform (y: 3339 surface)
    { x: 1350, y: 3290 },
    { x: 1550, y: 3290 }
];

// Give each player a UNIQUE spawn point (no overlapping)
function getUniqueSpawn(room) {
    const usedPositions = Object.values(room.players).map(p => ({ x: p.x, y: p.y }));

    // Find a spawn point not currently occupied
    const available = SPAWN_POINTS.filter(sp => {
        return !usedPositions.some(used =>
            Math.abs(used.x - sp.x) < 50 && Math.abs(used.y - sp.y) < 50
        );
    });

    if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
    }

    // Fallback: random from all spawns
    return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

io.on('connection', (socket) => {
    console.log('✅ A user connected: ' + socket.id);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  LOBBY EVENTS
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

        // Create room FIRST with empty players
        rooms[roomId] = {
            roomId,
            name: data.name || 'Unnamed Server',
            maxPlayers,
            players: {},
            hostId: socket.id
        };

        // Now get a spawn using the room
        const spawn = getUniqueSpawn(rooms[roomId]);

        const playerObj = {
            playerId: socket.id,
            x: spawn.x,
            y: spawn.y,
            flipX: false,
            anim: 'idle_anim',
            health: 100,
            kills: 0,
            deaths: 0
        };

        rooms[roomId].players[socket.id] = playerObj;

        socket.join(roomId);
        socket.roomId = roomId;

        console.log(`🏠 Room created: ${roomId} (${rooms[roomId].name}) by ${socket.id} | Spawn: (${spawn.x}, ${spawn.y})`);

        socket.emit('serverCreated', {
            roomId,
            name: rooms[roomId].name
        });

        socket.emit('currentPlayers', rooms[roomId].players);

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

        // Get unique spawn that doesn't overlap with existing players
        const spawn = getUniqueSpawn(room);

        const playerObj = {
            playerId: socket.id,
            x: spawn.x,
            y: spawn.y,
            flipX: false,
            anim: 'idle_anim',
            health: 100,
            kills: 0,
            deaths: 0
        };

        room.players[socket.id] = playerObj;
        socket.join(data.roomId);
        socket.roomId = data.roomId;

        const newCount = Object.keys(room.players).length;
        console.log(`🎮 ${socket.id} joined room: ${data.roomId} (${newCount}/${room.maxPlayers}) | Spawn: (${spawn.x}, ${spawn.y})`);

        // 1. Send room info to the joiner
        socket.emit('joinedServer', {
            roomId: data.roomId,
            name: room.name
        });

        // 2. Send ALL players (including self) to the joiner
        socket.emit('currentPlayers', room.players);

        // 3. Tell everyone ELSE about the new player
        socket.to(data.roomId).emit('newPlayer', playerObj);

        broadcastServerList();
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  IN-GAME EVENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    socket.on('playerMovement', (movementData) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms[roomId] || !rooms[roomId].players[socket.id]) return;

        const player = rooms[roomId].players[socket.id];
        player.x = movementData.x;
        player.y = movementData.y;
        player.flipX = movementData.flipX;
        player.anim = movementData.anim;

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

        const damage = attackData.damage || 10;
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

            console.log(`💀 ${attackData.targetId} killed by ${socket.id} | K:${attacker.kills} D:${target.deaths}`);

            io.to(roomId).emit('playerKilled', {
                killerId: socket.id,
                victimId: attackData.targetId,
                killerKills: attacker.kills,
                victimDeaths: target.deaths
            });

            // Respawn after 3 seconds
            setTimeout(() => {
                if (rooms[roomId] && rooms[roomId].players[attackData.targetId]) {
                    const respawnPoint = getUniqueSpawn(room);
                    target.health = 100;
                    target.x = respawnPoint.x;
                    target.y = respawnPoint.y;

                    console.log(`🔄 ${attackData.targetId} respawned at (${respawnPoint.x}, ${respawnPoint.y})`);

                    io.to(roomId).emit('playerRespawned', {
                        playerId: attackData.targetId,
                        x: respawnPoint.x,
                        y: respawnPoint.y,
                        health: 100
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
            kills: p.kills,
            deaths: p.deaths,
            health: p.health
        }));

        scoreboard.sort((a, b) => b.kills - a.kills);
        socket.emit('scoreboard', scoreboard);
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function leaveCurrentRoom(socket) {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

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
            console.log(`👑 New host for ${roomId}: ${room.hostId}`);
        }

        const scoreboard = Object.values(room.players).map(p => ({
            playerId: p.playerId,
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

server.listen(8081, () => {
    console.log('🚀 Listening on port 8081');
});