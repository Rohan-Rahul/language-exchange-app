const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "https://language-exchange-app-eight.vercel.app",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);
    socket.emit("me", socket.id);

    // 1. Join a specific Room
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // 2. Route all signals ONLY to that specific Room
    socket.on("callUser", (data) => {
        socket.to(data.roomId).emit("hey", { signal: data.signalData, from: socket.id });
    });

    socket.on("answerCall", (data) => {
        socket.to(data.roomId).emit("callAccepted", data.signal);
    });

    socket.on("endCall", (roomId) => {
        socket.to(roomId).emit("callEnded");
    });

    socket.on("stopScreenShare", (roomId) => {
        socket.to(roomId).emit("screenShareStopped");
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
