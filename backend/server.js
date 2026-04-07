const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io'); 
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Use your specific frontend port
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // When a user joins a room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // Relay WebRTC signals (Offers, Answers, ICE Candidates)
    socket.on('signal', (data) => {
        // Send the signal to everyone else in the room except the sender
        socket.to(data.roomId).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});