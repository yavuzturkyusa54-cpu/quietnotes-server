const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3333;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Quiet Notes Collab Server is running.');
});

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Connected users: Map<socketId, { username, status, color, roomId }>
const users = new Map();

const COLORS = ['#e8a87c', '#85dcb8', '#6c82dc', '#e06c75', '#d19a66', '#56b6c2', '#c678dd', '#98c379'];
let colorIndex = 0;

io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    // User connects and registers username
    socket.on('join', ({ username }) => {
        const color = COLORS[colorIndex % COLORS.length];
        colorIndex++;

        users.set(socket.id, {
            id: socket.id,
            username: username || 'Anonymous',
            status: 'online',
            color,
            roomId: null
        });

        console.log(`[JOIN] ${username} (${socket.id}) connected to server.`);
    });

    // User switches to a different note (room)
    socket.on('join-room', ({ roomId }) => {
        const user = users.get(socket.id);
        if (!user) return;

        // Leave old room
        if (user.roomId) {
            socket.leave(user.roomId);
            broadcastPresence(user.roomId);
        }

        // Join new room
        const room = roomId || 'default-room';
        user.roomId = room;
        socket.join(room);
        
        console.log(`[ROOM] ${user.username} joined Room: ${room}`);
        
        broadcastPresence(room);
        
        // Notify others in the room that someone joined so they can send the current note content
        socket.to(room).emit('user-joined', { username: user.username });
    });

    socket.on('typing', () => {
        const user = users.get(socket.id);
        if (user && user.roomId) {
            user.status = 'typing';
            socket.to(user.roomId).emit('user-typing', {
                username: user.username,
                color: user.color
            });

            clearTimeout(user._typingTimeout);
            user._typingTimeout = setTimeout(() => {
                if (users.has(socket.id)) {
                    user.status = 'online';
                    broadcastPresence(user.roomId);
                }
            }, 2000);
        }
    });

    // Content sync within the room
    socket.on('content-update', (data) => {
        const user = users.get(socket.id);
        if (user && user.roomId) {
            socket.to(user.roomId).emit('content-update', {
                ...data,
                username: user.username,
                userId: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            console.log(`[-] Disconnected: ${user.username} (${socket.id})`);
            const room = user.roomId;
            users.delete(socket.id);
            broadcastPresence(room);
        }
    });
});

function broadcastPresence(roomId) {
    const roomUsers = Array.from(users.values())
        .filter(u => u.roomId === roomId)
        .map(u => ({
            id: u.id,
            username: u.username,
            status: u.status,
            color: u.color
        }));
    io.to(roomId).emit('presence', { users: roomUsers, count: roomUsers.length });
}

server.listen(PORT, () => {
    console.log(`\n  ✦ Quiet Notes Collab Server`);
    console.log(`  ✦ Port: ${PORT}`);
    console.log(`  ✦ URL:  http://localhost:${PORT}\n`);
});
