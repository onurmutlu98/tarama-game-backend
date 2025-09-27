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
    const now = new Date();
    Object.keys(rooms).forEach(roomCode => {
        const room = rooms[roomCode];
        // Boş odaları 30 dakika sonra temizle
        if (room.players.length === 0) {
            const lastActivity = room.lastActivity || room.createdAt;
            const timeSinceLastActivity = now - lastActivity;
            if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 dakika
                delete rooms[roomCode];
                console.log(`Boş oda temizlendi: ${roomCode}`);
            }
        }
        // Çok eski odaları temizle (2 saat)
        else {
            const timeSinceCreated = now - room.createdAt;
            if (timeSinceCreated > 2 * 60 * 60 * 1000) { // 2 saat
                delete rooms[roomCode];
                console.log(`Eski oda temizlendi: ${roomCode}`);
            }
        }
    });
}

// Her 10 dakikada bir odaları kontrol et
setInterval(cleanupEmptyRooms, 10 * 60 * 1000);

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
                board: Array(20).fill().map(() => Array(20).fill(null)),
                currentPlayer: 0,
                gameStarted: false,
                gameEnded: false,
                winner: null,
                scores: [0, 0], // Oyuncu skorlarını başlat
                disabledPoints: [] // Etkisiz noktaları başlat
            },
            createdAt: new Date(),
            lastActivity: new Date()
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
                
                // Oyuncu bilgileriyle birlikte gameState gönder
                const gameStateWithPlayers = {
                    ...rooms[roomCode].gameState,
                    players: rooms[roomCode].players
                };
                
                io.to(roomCode).emit("gameStarted", gameStateWithPlayers);
                console.log(`Oyun başladı: ${roomCode}`);
            }
        }
    });

    // Oyun hamlesi
    socket.on("makeMove", ({ roomCode, row, col, playerIndex }) => {
        if (!rooms[roomCode] || !rooms[roomCode].gameState.gameStarted) {
            return;
        }

        const room = rooms[roomCode];
        const actualPlayerIndex = room.players.findIndex(p => p.id === socket.id);
        
        // Güvenlik kontrolü: gönderilen playerIndex ile gerçek playerIndex eşleşmeli
        if (actualPlayerIndex !== playerIndex) {
            socket.emit("error", "Geçersiz oyuncu!");
            return;
        }
        
        if (actualPlayerIndex !== room.gameState.currentPlayer) {
            socket.emit("error", "Sıra sizde değil!");
            return;
        }

        if (room.gameState.board[row][col] !== null) {
            socket.emit("error", "Bu kare zaten dolu!");
            return;
        }

        // Hamleyi yap
        room.gameState.board[row][col] = actualPlayerIndex;
        
        // Sırayı değiştirme - manuel olarak yapılacak
        // room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;

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

    // Çevreleme validasyon fonksiyonları
    function areNeighbors(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Kenar uzunluğu kuralı: sadece 1 birim (yatay/dikey) veya √2 birim (çapraz)
        return Math.abs(distance - 1) < 0.001 || Math.abs(distance - Math.sqrt(2)) < 0.001;
    }

    function arePointsConnected(points) {
        if (points.length < 2) return false;
        
        // Her nokta en az bir diğer noktaya komşu olmalı
        for (let i = 0; i < points.length; i++) {
            let hasNeighbor = false;
            for (let j = 0; j < points.length; j++) {
                if (i !== j && areNeighbors(points[i].x, points[i].y, points[j].x, points[j].y)) {
                    hasNeighbor = true;
                    break;
                }
            }
            if (!hasNeighbor) return false;
        }
        return true;
    }

    function formsClosedShape(points) {
        if (points.length < 4) return false;
        
        // Her nokta en az 2 komşuya sahip olmalı (kapalı şekil için)
        for (let i = 0; i < points.length; i++) {
            let neighborCount = 0;
            for (let j = 0; j < points.length; j++) {
                if (i !== j && areNeighbors(points[i].x, points[i].y, points[j].x, points[j].y)) {
                    neighborCount++;
                }
            }
            if (neighborCount < 2) return false;
        }
        return true;
    }

    function isPointInPolygon(x, y, polygon) {
        // Ray casting algoritması - basit ve etkili
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    function getEnclosedPoints(selectedPoints, gameBoard) {
        const enclosedPoints = [];
        
        console.log('🔍 Çevreleme tespiti başlıyor, seçilen noktalar:', selectedPoints);
        
        // Grid üzerindeki tüm noktaları kontrol et
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                if (isPointInPolygon(col, row, selectedPoints)) {
                    enclosedPoints.push({x: col, y: row});
                    console.log(`✓ Çevrelenen nokta tespit edildi: (${col}, ${row})`);
                }
            }
        }
        
        console.log(`📊 Toplam çevrelenen nokta sayısı: ${enclosedPoints.length}`);
        return enclosedPoints;
    }

    function validateEnclosure(selectedPoints, gameBoard, currentPlayer) {
        console.log('Çevreleme validasyonu başlıyor...');
        
        // 1. Minimum nokta sayısı kontrolü
        if (selectedPoints.length < 4) {
            console.log('Yetersiz nokta sayısı:', selectedPoints.length);
            return { valid: false, message: 'Çevreleme için en az 4 nokta seçmelisiniz!' };
        }
        
        // 2. Noktaların bağlantılı olup olmadığını kontrol et
        if (!arePointsConnected(selectedPoints)) {
            console.log('Noktalar bağlantılı değil');
            return { valid: false, message: 'Seçilen noktalar birbirine bağlantılı olmalıdır!' };
        }
        
        // 3. Kapalı şekil kontrolü
        if (!formsClosedShape(selectedPoints)) {
            console.log('Kapalı şekil oluşturmuyor');
            return { valid: false, message: 'Seçilen noktalar kapalı bir şekil oluşturmalıdır!' };
        }
        
        // 4. Çevrelenen alanın içinde rakip noktalar olup olmadığını kontrol et
        const enclosedPoints = getEnclosedPoints(selectedPoints, gameBoard);
        const opponentPlayer = 1 - currentPlayer;
        
        let hasOpponentPoints = false;
        let enclosedOpponentCount = 0;
        
        for (const point of enclosedPoints) {
            if (gameBoard[point.y] && gameBoard[point.y][point.x] === opponentPlayer) {
                hasOpponentPoints = true;
                enclosedOpponentCount++;
            }
        }
        
        if (!hasOpponentPoints) {
            console.log('Çevrelenen alanda rakip nokta yok');
            return { valid: false, message: 'Çevreleme geçerli olması için rakip noktaları içermelidir!' };
        }
        
        console.log('Çevreleme geçerli! Çevrelenen rakip nokta sayısı:', enclosedOpponentCount);
        return { 
            valid: true, 
            enclosedPoints: enclosedPoints,
            enclosedOpponentCount: enclosedOpponentCount
        };
    }

    // Çevreleme bitirme
    socket.on('finishEnclosure', (data) => {
        console.log('finishEnclosure eventi alındı:', data);
        const room = rooms[data.roomCode];
        if (!room) {
            console.log('Oda bulunamadı:', data.roomCode);
            return;
        }
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) {
            console.log('Oyuncu bulunamadı');
            return;
        }
        
        console.log('Çevreleme isteği - playerIndex:', playerIndex, 'currentPlayer:', room.gameState.currentPlayer);
        
        if (room.gameState.currentPlayer !== playerIndex) {
            console.log('Sıra bu oyuncuda değil');
            socket.emit('enclosureFinished', {
                success: false,
                message: 'Sıra sizde değil!'
            });
            return;
        }

        // Tam çevreleme doğrulaması
        const validation = validateEnclosure(data.selectedPoints, room.gameState.board, playerIndex);
        
        if (!validation.valid) {
            console.log('Çevreleme geçersiz:', validation.message);
            socket.emit('enclosureFinished', {
                success: false,
                message: validation.message
            });
            return;
        }

        // Geçerli çevreleme - puan ver ve sırayı değiştir
        console.log('Çevreleme geçerli! Puan veriliyor...');
        
        // Puan sistemi ekle
        if (!room.gameState.scores) {
            room.gameState.scores = [0, 0]; // [player0, player1]
        }
        
        room.gameState.scores[playerIndex] += validation.enclosedOpponentCount;
        
        // Çevrelenen rakip noktaları etkisiz hale getir
        if (!room.gameState.disabledPoints) {
            room.gameState.disabledPoints = [];
        }
        
        const opponentPlayer = 1 - playerIndex;
        
        // ÖNEMLİ: Seçilen çevreleme noktalarını kaydet (bu noktalar ASLA etkisiz hale getirilmeyecek)
        const selectedPointsSet = new Set(data.selectedPoints.map(p => `${p.x},${p.y}`));
        console.log(`🔒 Seçilen çevreleme noktaları korunacak:`, data.selectedPoints);
        
        // YENİ MANTIK: Alan içindeki TÜM noktaları etkisiz hale getir
        for (const point of validation.enclosedPoints) {
            // Seçilen çevreleme noktalarını kontrol et - bunlar ASLA etkisiz hale getirilmez
            const pointKey = `${point.x},${point.y}`;
            if (selectedPointsSet.has(pointKey)) {
                console.log(`🛡️ SEÇİLEN NOKTA KORUNDU: (${point.x}, ${point.y}) - çevreleme noktası olduğu için etkisiz hale getirilmedi`);
                continue; // Bu noktayı atla, etkisiz hale getirme
            }
            
            const pointValue = room.gameState.board[point.y] && room.gameState.board[point.y][point.x];
            
            // RAKIP OYUNCUNUN NOKTALARI - Puan ver ve etkisiz yap
            if (pointValue === opponentPlayer) {
                // Rakip nokta zaten etkisiz mi kontrol et
                const alreadyDisabled = room.gameState.disabledPoints.some(dp =>
                    dp.x === point.x && dp.y === point.y && dp.player === opponentPlayer
                );
                
                if (!alreadyDisabled) {
                    room.gameState.disabledPoints.push({
                        x: point.x,
                        y: point.y,
                        player: opponentPlayer
                    });
                    console.log(`✓ Rakip nokta etkisiz hale getirildi: (${point.x}, ${point.y}) - player: ${opponentPlayer}`);
                }
            }
            // BOŞ NOKTALAR - Sadece etkisiz yap (puan verme)
            else if (pointValue === 0) {
                // Boş nokta zaten etkisiz mi kontrol et
                const alreadyDisabled = room.gameState.disabledPoints.some(dp =>
                    dp.x === point.x && dp.y === point.y && dp.player === 0
                );
                
                if (!alreadyDisabled) {
                    room.gameState.disabledPoints.push({
                        x: point.x,
                        y: point.y,
                        player: 0 // 0 = boş nokta etkisiz
                    });
                    console.log(`✓ Boş nokta etkisiz hale getirildi: (${point.x}, ${point.y})`);
                }
            }
            // KENDİ OYUNCUNUN NOKTALARI - Sadece etkisiz yap (puan verme, çevreleme noktaları hariç)
            else if (pointValue === playerIndex) {
                // Kendi nokta zaten etkisiz mi kontrol et
                const alreadyDisabled = room.gameState.disabledPoints.some(dp =>
                    dp.x === point.x && dp.y === point.y && dp.player === playerIndex
                );
                
                if (!alreadyDisabled) {
                    room.gameState.disabledPoints.push({
                        x: point.x,
                        y: point.y,
                        player: playerIndex
                    });
                    console.log(`✓ Kendi nokta etkisiz hale getirildi: (${point.x}, ${point.y}) - player: ${playerIndex}`);
                }
            }
        }
        
        // Sırayı değiştir
        room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;
        console.log('Çevreleme tamamlandı, yeni currentPlayer:', room.gameState.currentPlayer);
        console.log('Güncel skorlar:', room.gameState.scores);
        
        io.to(data.roomCode).emit('enclosureFinished', {
            success: true,
            gameState: room.gameState,
            enclosedPoints: data.selectedPoints,
            score: validation.enclosedOpponentCount,
            totalScores: room.gameState.scores
        });
        
        console.log('enclosureFinished eventi gönderildi');
    });

    // Çevreleme iptal etme
    socket.on('cancelEnclosure', (data) => {
        console.log('Çevreleme iptal edildi:', data);
        const room = rooms[data.roomCode];
        if (!room) return;
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;
        
        console.log('Çevreleme iptal - playerIndex:', playerIndex, 'currentPlayer:', room.gameState.currentPlayer);
        
        // Çevreleme iptal edildiğinde sırayı karşı oyuncuya geç (yerel oyun kuralları ile aynı)
        room.gameState.currentPlayer = 1 - room.gameState.currentPlayer;
        console.log('Çevreleme iptal edildi, yeni currentPlayer:', room.gameState.currentPlayer);
        
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
            board: Array(20).fill().map(() => Array(20).fill(null)),
            currentPlayer: 0,
            gameStarted: false,
            gameEnded: false,
            winner: null,
            scores: [0, 0], // Oyuncu skorlarını sıfırla
            disabledPoints: [] // Etkisiz noktaları sıfırla
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
                console.log(`Oyuncu ${socket.id} odadan çıkarıldı: ${roomCode}`);
                
                // Oda boş kaldıysa, lastActivity zamanını güncelle
                if (room.players.length === 0) {
                    room.lastActivity = new Date();
                    console.log(`Oda boş kaldı: ${roomCode} - 30 dakika sonra silinecek`);
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