const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Oyun odaları
let rooms = {};

// Rastgele oda kodu oluştur
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log("Oyuncu bağlandı:", socket.id);

    // Oda oluştur
    socket.on("createRoom", (playerName) => {
        const roomCode = generateRoomCode();
        
        rooms[roomCode] = {
            players: [{
                id: socket.id,
                name: playerName,
                ready: false,
                isHost: true
            }],
            gameState: {
                board: Array(10).fill().map(() => Array(10).fill(null)),
                currentPlayer: 0,
                gameStarted: false,
                gameEnded: false,
                winner: null
            }
        };

        socket.join(roomCode);
        socket.emit("roomCreated", { roomCode, isHost: true });
        console.log(`Oda oluşturuldu: ${roomCode} - Host: ${playerName}`);
    });

    // Odaya katıl
    socket.on("joinRoom", ({ roomCode, playerName }) => {
        if (!rooms[roomCode]) {
            socket.emit("error", "Oda bulunamadı!");
            return;
        }

        if (rooms[roomCode].players.length >= 2) {
            socket.emit("error", "Oda dolu!");
            return;
        }

        rooms[roomCode].players.push({
            id: socket.id,
            name: playerName,
            ready: false,
            isHost: false
        });

        socket.join(roomCode);
        socket.emit("roomJoined", { roomCode, isHost: false });
        
        // Odadaki tüm oyunculara güncel oyuncu listesini gönder
        io.to(roomCode).emit("playersUpdate", rooms[roomCode].players);
        console.log(`${playerName} odaya katıldı: ${roomCode}`);
    });

    // Hazır durumu değiştir
    socket.on("toggleReady", (roomCode) => {
        if (!rooms[roomCode]) return;

        const player = rooms[roomCode].players.find(p => p.id === socket.id);
        if (player) {
            player.ready = !player.ready;
            io.to(roomCode).emit("playersUpdate", rooms[roomCode].players);

            // İki oyuncu da hazırsa oyunu başlat
            if (rooms[roomCode].players.length === 2 && 
                rooms[roomCode].players.every(p => p.ready)) {
                
                rooms[roomCode].gameState.gameStarted = true;
                io.to(roomCode).emit("gameStarted", rooms[roomCode].gameState);
                console.log(`Oyun başladı: ${roomCode}`);
            }
        }
    });

    // Oyun hamlesi
    socket.on("makeMove", ({ roomCode, row, col }) => {
        if (!rooms[roomCode] || !rooms[roomCode].gameState.gameStarted) return;

        const room = rooms[roomCode];
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex !== room.gameState.currentPlayer) {
            socket.emit("error", "Sıra sizde değil!");
            return;
        }

        if (room.gameState.board[row][col] !== null) {
            socket.emit("error", "Bu kare zaten dolu!");
            return;
        }

        // Hamleyi yap
        room.gameState.board[row][col] = playerIndex;
        
        // Sırayı değiştir
        room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;

        // Tüm oyunculara güncel durumu gönder
        io.to(roomCode).emit("gameUpdate", room.gameState);
    });

    // Çevreleme başlatma
    socket.on('startEnclosure', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Oyuncunun sırası mı kontrol et
        if (room.gameState.currentPlayer !== player.playerNumber) return;
        
        room.gameState.manualEnclosureMode = true;
        room.gameState.selectedPointsForEnclosure = [];
        
        // Tüm oyunculara çevreleme modunun başladığını bildir
        io.to(data.roomCode).emit('enclosureStarted', {
            player: player.playerNumber
        });
    });

    // Sıra geçme
    socket.on('passTurn', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Oyuncunun sırası mı kontrol et
        if (room.gameState.currentPlayer !== player.playerNumber) return;
        
        // Sırayı değiştir
        room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;
        room.gameState.waitingForPlayerAction = false;
        
        // Tüm oyunculara sıra değişimini bildir
        io.to(data.roomCode).emit('turnPassed', {
            currentPlayer: room.gameState.currentPlayer
        });
    });

    // Çevreleme bitirme
    socket.on('finishEnclosure', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Oyuncunun sırası mı kontrol et
        if (room.gameState.currentPlayer !== player.playerNumber) return;
        
        // Çevreleme doğrulaması (basit kontrol)
        if (data.selectedPoints.length >= 4) {
            // Çevreleme başarılı - puan ver
            if (player.playerNumber === 1) {
                room.gameState.player1Score += data.selectedPoints.length;
            } else {
                room.gameState.player2Score += data.selectedPoints.length;
            }
            
            // Sırayı değiştir
            room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;
            room.gameState.manualEnclosureMode = false;
            room.gameState.selectedPointsForEnclosure = [];
            
            // Tüm oyunculara çevreleme sonucunu bildir
            io.to(data.roomCode).emit('enclosureFinished', {
                success: true,
                player: player.playerNumber,
                selectedPoints: data.selectedPoints,
                gameState: room.gameState
            });
        } else {
            // Geçersiz çevreleme
            io.to(socket.id).emit('enclosureFinished', {
                success: false,
                message: 'Çevreleme için en az 4 nokta gerekli!'
            });
        }
    });

    // Çevreleme iptal etme
    socket.on('cancelEnclosure', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Oyuncunun sırası mı kontrol et
        if (room.gameState.currentPlayer !== player.playerNumber) return;
        
        // Sırayı değiştir ve çevreleme modunu kapat
        room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;
        room.gameState.manualEnclosureMode = false;
        room.gameState.selectedPointsForEnclosure = [];
        room.gameState.waitingForPlayerAction = false;
        
        // Tüm oyunculara çevreleme iptalini bildir
        io.to(data.roomCode).emit('enclosureCancelled', {
            currentPlayer: room.gameState.currentPlayer
        });
    });

    // Oyunu yeniden başlat
    socket.on('restartGame', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return; // Sadece host yeniden başlatabilir
        
        // Oyun durumunu sıfırla
        room.gameState = {
            board: Array(20).fill().map(() => Array(20).fill(0)),
            currentPlayer: 1,
            player1Score: 0,
            player2Score: 0,
            gameEnded: false,
            gameStarted: true,
            manualEnclosureMode: false,
            selectedPointsForEnclosure: [],
            waitingForPlayerAction: false
        };
        
        // Tüm oyuncuları hazır değil yap
        room.players.forEach(p => p.ready = false);
        
        // Tüm oyunculara yeni oyun durumunu gönder
        io.to(data.roomCode).emit('gameRestarted', {
            gameState: room.gameState
        });
        
        io.to(data.roomCode).emit('playersUpdate', room.players);
    });

    socket.on("disconnect", () => {
        console.log("Oyuncu ayrıldı:", socket.id);

        // Tüm odalardan çıkar
        for (let roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    // Oda boşsa sil
                    delete rooms[roomCode];
                    console.log(`Oda silindi: ${roomCode}`);
                } else {
                    // Kalan oyuncuya bildir
                    io.to(roomCode).emit("playerLeft");
                    io.to(roomCode).emit("playersUpdate", room.players);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server çalışıyor - Port: ${PORT}`);
});
