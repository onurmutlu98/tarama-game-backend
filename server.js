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

// Oyun durumu
let gameRooms = {};

// Socket bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    // Oyun odasına katıl
    socket.on('joinGame', (data) => {
        const { roomId, playerName } = data;
        
        if (!gameRooms[roomId]) {
            // Yeni oda oluştur
            gameRooms[roomId] = {
                players: [],
                gameState: {
                    grid: Array(20).fill().map(() => Array(20).fill(0)),
                    currentPlayer: 1,
                    gameStarted: false,
                    gameEnded: false,
                    winner: null,
                    disabledPoints: []
                }
            };
        }

        const room = gameRooms[roomId];
        
        // Oyuncu sayısı kontrolü
        if (room.players.length >= 2) {
            socket.emit('roomFull');
            return;
        }

        // Oyuncuyu odaya ekle
        const playerId = room.players.length + 1;
        const player = {
            id: socket.id,
            name: playerName,
            playerId: playerId
        };
        
        room.players.push(player);
        socket.join(roomId);
        socket.playerId = playerId;
        socket.roomId = roomId;

        console.log(`Oyuncu ${playerName} (${playerId}) ${roomId} odasına katıldı`);

        // Oyuncu bilgilerini gönder
        socket.emit('playerAssigned', { playerId, playerName });
        
        // Oda durumunu güncelle
        io.to(roomId).emit('roomUpdate', {
            players: room.players,
            gameState: room.gameState
        });

        // 2 oyuncu varsa oyunu başlat
        if (room.players.length === 2) {
            room.gameState.gameStarted = true;
            io.to(roomId).emit('gameStart', room.gameState);
        }
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
        
        // Çevreleme kontrolü
        const surroundedPoints = checkSurrounding(gameState.grid, row, col, socket.playerId);
        if (surroundedPoints.length > 0) {
            // Çevrelenen noktaları etkisiz yap
            surroundedPoints.forEach(point => {
                gameState.disabledPoints.push(point);
            });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});