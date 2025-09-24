const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS']
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Tarama Game Backend Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        rooms: Object.keys(rooms).length,
        connections: io.engine.clientsCount
    });
});

// Oyun odaları
let rooms = {};

// Rastgele oda kodu oluştur
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Boş odaları temizle
function cleanupEmptyRooms() {
    Object.keys(rooms).forEach(roomCode => {
        if (rooms[roomCode].players.length === 0) {
            delete rooms[roomCode];
            console.log(`Boş oda temizlendi: ${roomCode}`);
        }
    });
}

// Her 5 dakikada bir boş odaları temizle
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

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
            },
            createdAt: new Date()
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
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;
        
        if (room.gameState.currentPlayer !== playerIndex) return;
        
        io.to(data.roomCode).emit('enclosureStarted', {
            player: playerIndex,
            currentPlayer: room.gameState.currentPlayer
        });
    });

    // Çevreleme bitirme
    socket.on('finishEnclosure', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;
        
        if (room.gameState.currentPlayer !== playerIndex) return;

        // Çevreleme mantığını burada uygula
        // Şimdilik basit bir onay gönderelim
        room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;
        
        io.to(data.roomCode).emit('enclosureFinished', {
            success: true,
            gameState: room.gameState
        });
    });

    // Çevreleme iptal etme
    socket.on('cancelEnclosure', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        io.to(data.roomCode).emit('enclosureCancelled', {
            currentPlayer: room.gameState.currentPlayer
        });
    });

    // Sıra geçme
    socket.on('passTurn', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;
        
        if (room.gameState.currentPlayer !== playerIndex) return;
        
        room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;
        
        io.to(data.roomCode).emit('turnPassed', {
            currentPlayer: room.gameState.currentPlayer
        });
    });

    // Oyunu yeniden başlat
    socket.on('restartGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;
        
        // Oyun durumunu sıfırla
        room.gameState = {
            board: Array(10).fill().map(() => Array(10).fill(null)),
            currentPlayer: 0,
            gameStarted: false,
            gameEnded: false,
            winner: null
        };
        
        // Oyuncuları hazır değil yap
        room.players.forEach(p => p.ready = false);
        
        io.to(roomCode).emit('gameRestarted');
        io.to(roomCode).emit("playersUpdate", room.players);
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        
        // Oyuncuyu tüm odalardan çıkar
        Object.keys(rooms).forEach(roomCode => {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                    console.log(`Oda silindi: ${roomCode}`);
                } else {
                    // Kalan oyuncuya host yetkisi ver
                    if (room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    io.to(roomCode).emit("playersUpdate", room.players);
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});