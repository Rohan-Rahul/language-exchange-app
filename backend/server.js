const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        // MUST include https:// and no trailing slash
        origin: "https://language-exchange-a67spjbp7-rahulp-fxs-projects.vercel.app",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);
    socket.emit("me", socket.id);

    // Room joining logic
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on("callUser", (data) => {
        // If using rooms, use: socket.to(data.roomId).emit(...)
        socket.broadcast.emit("hey", { signal: data.signalData, from: socket.id });
    });

    socket.on("answerCall", (data) => {
        socket.broadcast.emit("callAccepted", data.signal);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });
});

// Use process.env.PORT for deployment (Render/Railway/Heroku)
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});