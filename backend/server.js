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

const PORT = 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});