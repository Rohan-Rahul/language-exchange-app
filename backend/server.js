const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "language-exchange-a67spjbp7-rahulp-fxs-projects.vercel.app", // Use your specific frontend port
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    socket.emit("me", socket.id);

    socket.on("callUser", (data) => {
        // Broadcast to everyone else that a call is starting
        socket.broadcast.emit("hey", { signal: data.signalData, from: socket.id });
    });

    socket.on("answerCall", (data) => {
        socket.broadcast.emit("callAccepted", data.signal);
    });
});

socket.on("join-room", (roomId) => {
    socket.join(roomId);
    // Now, only send 'hey' or 'callAccepted' to people in that specific room
    // Use socket.to(roomId).emit(...) instead of socket.broadcast.emit(...)
});

const PORT = 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});