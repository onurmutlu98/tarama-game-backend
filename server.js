const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Static dosyaları serve et
app.use(express.static(path.join(__dirname)));

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Online multiplayer sayfası
app.get('/online', (req, res) => {
    res.sendFile(path.join(__dirname, 'online.html'));
});

// Oyun durumu
let gameRooms = {};

// Oda ID oluşturucu
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    // Yeni oda oluştur
    socket.on('createRoom', (data) => {
        const { playerName } = data;
        const roomId = generateRoomId();
        
        gameRooms[roomId] = {
            players: [],
            gameState: {
                grid: Array(20).fill().map(() => Array(20).fill(0)),
                currentPlayer: 1,
                gameStarted: false,
                gameEnded: false,
                winner: null,
                disabledPoints: [],
                player1Score: 0,
                player2Score: 0,
                enclosureCount: 0,
                moveHistory: []
            }
        };

        // Oyuncuyu odaya ekle
        const player = {
            id: socket.id,
            name: playerName,
            playerId: 1,
            ready: false
        };
        
        gameRooms[roomId].players.push(player);
        socket.join(roomId);
        socket.playerId = 1;
        socket.roomId = roomId;

        console.log(`Oyuncu ${playerName} yeni oda oluşturdu: ${roomId}`);

        socket.emit('roomCreated', { roomId, playerId: 1, playerName });
    });

    // Oyun odasına katıl
    socket.on('joinRoom', (data) => {
        const { roomId, playerName } = data;
        
        if (!gameRooms[roomId]) {
            socket.emit('roomNotFound');
            return;
        }

        const room = gameRooms[roomId];
        
        // Oyuncu sayısı kontrolü
        if (room.players.length >= 2) {
            socket.emit('roomFull');
            return;
        }

        // Oyuncuyu odaya ekle
        const playerId = 2;
        const player = {
            id: socket.id,
            name: playerName,
            playerId: playerId,
            ready: false
        };
        
        room.players.push(player);
        socket.join(roomId);
        socket.playerId = playerId;
        socket.roomId = roomId;

        console.log(`Oyuncu ${playerName} (${playerId}) ${roomId} odasına katıldı`);

        // Oyuncu bilgilerini gönder
        socket.emit('playerJoined', { playerId, playerName, roomId });
        
        // Oda durumunu güncelle
        io.to(roomId).emit('roomUpdate', {
            players: room.players,
            gameState: room.gameState
        });

        // Artık otomatik başlatma yok - iki oyuncu da hazır olmalı
    });

    // Hamle yap
    socket.on('makeMove', (data) => {
        const { roomId, row, col } = data;
        const room = gameRooms[roomId];
        
        if (!room || !room.gameState.gameStarted || room.gameState.gameEnded) {
            return;
        }

        const gameState = room.gameState;
        
        // Sıra kontrolü
        if (gameState.currentPlayer !== socket.playerId) {
            return;
        }

        // Geçerli hamle kontrolü
        if (gameState.grid[row][col] !== 0) {
            return;
        }

        // Etkisiz nokta kontrolü
        const isDisabled = gameState.disabledPoints.some(point => 
            point.x === col && point.y === row
        );
        if (isDisabled) {
            return;
        }

        // Hamleyi yap
        gameState.grid[row][col] = socket.playerId;
        gameState.moveHistory.push({ row, col, player: socket.playerId });
        
        // Çevreleme kontrolü
        const surroundedPoints = checkSurrounding(gameState.grid, row, col, socket.playerId);
        if (surroundedPoints.length > 0) {
            // Çevrelenen noktaları etkisiz yap
            surroundedPoints.forEach(point => {
                gameState.disabledPoints.push(point);
            });
            
            // Skor güncelle
            if (socket.playerId === 1) {
                gameState.player1Score += surroundedPoints.length;
            } else {
                gameState.player2Score += surroundedPoints.length;
            }
            gameState.enclosureCount++;
        }

        // Kazanan kontrolü
        const winner = checkWinner(gameState.grid);
        if (winner) {
            gameState.gameEnded = true;
            gameState.winner = winner;
        }

        // Sırayı değiştir
        gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

        // Güncellenmiş durumu gönder
        io.to(roomId).emit('gameUpdate', {
            gameState: gameState,
            lastMove: { row, col, player: socket.playerId },
            surroundedPoints: surroundedPoints
        });
    });

    // Manuel çevreleme
    socket.on('manualEnclosure', (data) => {
        const { roomId, selectedPoints } = data;
        const room = gameRooms[roomId];
        
        if (!room || !room.gameState.gameStarted || room.gameState.gameEnded) {
            return;
        }

        const gameState = room.gameState;
        
        // Sıra kontrolü
        if (gameState.currentPlayer !== socket.playerId) {
            return;
        }

        // Manuel çevreleme doğrulama
        const isValidEnclosure = validateManualEnclosure(gameState.grid, selectedPoints, socket.playerId);
        
        if (isValidEnclosure) {
            // Çevrelenen noktaları etkisiz yap
            selectedPoints.forEach(point => {
                gameState.disabledPoints.push(point);
            });
            
            // Skor güncelle
            if (socket.playerId === 1) {
                gameState.player1Score += selectedPoints.length;
            } else {
                gameState.player2Score += selectedPoints.length;
            }
            gameState.enclosureCount++;

            // Sırayı değiştir
            gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

            // Güncellenmiş durumu gönder
            io.to(roomId).emit('gameUpdate', {
                gameState: gameState,
                manualEnclosure: selectedPoints,
                enclosureValid: true
            });
        } else {
            socket.emit('enclosureInvalid');
        }
    });

    // Oyuncu hazır durumu
    socket.on('playerReady', (data) => {
        const { roomId, playerId, ready } = data;
        
        if (!gameRooms[roomId]) {
            return;
        }
        
        const room = gameRooms[roomId];
        const player = room.players.find(p => p.playerId === playerId);
        
        if (player) {
            player.ready = ready;
            console.log(`Oyuncu ${player.name} (${playerId}) hazır durumu: ${ready}`);
            
            // Tüm oyunculara hazır durumu değişikliğini bildir
            io.to(roomId).emit('playerReadyChanged', { playerId, ready });
            
            // Oda durumunu güncelle
            io.to(roomId).emit('roomUpdate', {
                players: room.players,
                gameState: room.gameState
            });
            
            // İki oyuncu da hazırsa oyunu başlat
            if (room.players.length === 2 && room.players.every(p => p.ready)) {
                room.gameState.gameStarted = true;
                console.log(`Oda ${roomId} - Oyun başlıyor!`);
                
                io.to(roomId).emit('gameStart', {
                    gameState: room.gameState,
                    players: room.players
                });
            }
        }
    });

    // Odadan ayrılma
    socket.on('leaveRoom', (data) => {
        const { roomId, playerId } = data;
        
        if (gameRooms[roomId]) {
            const room = gameRooms[roomId];
            room.players = room.players.filter(p => p.playerId !== playerId);
            
            // Oda boşsa sil
            if (room.players.length === 0) {
                delete gameRooms[roomId];
                console.log(`Oda ${roomId} silindi`);
            } else {
                // Diğer oyuncuya bildir
                io.to(roomId).emit('playerDisconnected');
                console.log(`Oyuncu ${playerId} oda ${roomId}'dan ayrıldı`);
            }
        }
        
        socket.leave(roomId);
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        
        if (socket.roomId && gameRooms[socket.roomId]) {
            const room = gameRooms[socket.roomId];
            room.players = room.players.filter(p => p.id !== socket.id);
            
            // Oda boşsa sil
            if (room.players.length === 0) {
                delete gameRooms[socket.roomId];
            } else {
                // Diğer oyuncuya bildir
                io.to(socket.roomId).emit('playerDisconnected');
            }
        }
    });
});

// Çevreleme kontrolü fonksiyonu
function checkSurrounding(grid, row, col, playerId) {
    const surroundedPoints = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    // Her yön için çevreleme kontrolü
    directions.forEach(([dx, dy]) => {
        const points = [];
        let x = col + dx;
        let y = row + dy;

        // Bu yönde ilerle (12x12 grid boyutu)
        while (x >= 0 && x < 20 && y >= 0 && y < 20) {
            if (grid[y][x] === playerId) {
                // Kendi taşımıza ulaştık, çevreleme var
                points.forEach(point => {
                    if (!surroundedPoints.some(sp => sp.x === point.x && sp.y === point.y)) {
                        surroundedPoints.push(point);
                    }
                });
                break;
            } else if (grid[y][x] === 0) {
                // Boş nokta
                points.push({ x, y });
            } else {
                // Rakip taşı, çevreleme yok
                break;
            }
            x += dx;
            y += dy;
        }
    });

    return surroundedPoints;
}

// Kazanan kontrolü
function checkWinner(grid) {
    // 5 taş sıralama kontrolü (yatay, dikey, çapraz)
    for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 20; col++) {
            if (grid[row][col] !== 0) {
                const player = grid[row][col];
                
                // Yatay kontrol
                if (col <= 10) {
                    let count = 0;
                    for (let i = 0; i < 5; i++) {
                        if (grid[row][col + i] === player) count++;
                    }
                    if (count === 5) return player;
                }
                
                // Dikey kontrol
                if (row <= 10) {
                    let count = 0;
                    for (let i = 0; i < 5; i++) {
                        if (grid[row + i][col] === player) count++;
                    }
                    if (count === 5) return player;
                }
                
                // Çapraz kontrol (sol üst - sağ alt)
                if (row <= 10 && col <= 10) {
                    let count = 0;
                    for (let i = 0; i < 5; i++) {
                        if (grid[row + i][col + i] === player) count++;
                    }
                    if (count === 5) return player;
                }
                
                // Çapraz kontrol (sağ üst - sol alt)
                if (row <= 10 && col >= 4) {
                    let count = 0;
                    for (let i = 0; i < 5; i++) {
                        if (grid[row + i][col - i] === player) count++;
                    }
                    if (count === 5) return player;
                }
            }
        }
    }
    return null;
}

// Manuel çevreleme doğrulama fonksiyonu
function validateManualEnclosure(grid, selectedPoints, playerId) {
    if (selectedPoints.length === 0) return false;
    
    // Seçilen noktaların hepsi boş olmalı
    for (let point of selectedPoints) {
        if (grid[point.y][point.x] !== 0) {
            return false;
        }
    }
    
    // Çevreleme doğrulama algoritması
    // Basit kontrol: seçilen noktaların etrafında oyuncunun taşları var mı?
    for (let point of selectedPoints) {
        let surrounded = false;
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let [dx, dy] of directions) {
            const x = point.x + dx;
            const y = point.y + dy;
            
            if (x >= 0 && x < 20 && y >= 0 && y < 20) {
                if (grid[y][x] === playerId) {
                    surrounded = true;
                    break;
                }
            }
        }
        
        if (!surrounded) {
            return false;
        }
    }
    
    return true;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor - Tüm cihazlardan erişilebilir`);
});