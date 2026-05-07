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
            hostId: socket.id
        };

        const spawn = getUniqueSpawn(rooms[roomId]);

        rooms[roomId].players[socket.id] = {
            playerId: socket.id,
            x: spawn.x,
            y: spawn.y,
            flipX: false,
            anim: 'idle_anim',
            health: 100,
            kills: 0,
            deaths: 0
        };

        socket.join(roomId);
        socket.roomId = roomId;

        console.log(`🏠 Room created: ${roomId} | Spawn: (${spawn.x}, ${spawn.y})`);

        // ✅ Only send serverCreated — GameScene will requestPlayers
        socket.emit('serverCreated', { roomId, name: rooms[roomId].name });

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

        console.log(`🎮 ${socket.id} joined: ${data.roomId} (${Object.keys(room.players).length}/${room.maxPlayers})`);

        // ✅ Only send joinedServer — GameScene will requestPlayers
        socket.emit('joinedServer', { roomId: data.roomId, name: room.name });

        // ✅ Tell OTHER players about the new player
        socket.to(data.roomId).emit('newPlayer', playerObj);

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

            console.log(`💀 ${attackData.targetId} killed by ${socket.id}`);

            io.to(roomId).emit('playerKilled', {
                killerId: socket.id,
                victimId: attackData.targetId,
                killerKills: attacker.kills,
                victimDeaths: target.deaths
            });

            setTimeout(() => {
                if (rooms[roomId] && rooms[roomId].players[attackData.targetId]) {
                    const respawnPoint = getUniqueSpawn(room);
                    target.health = 100;
                    target.x = respawnPoint.x;
                    target.y = respawnPoint.y;

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
            console.log(`👑 New host: ${room.hostId}`);
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