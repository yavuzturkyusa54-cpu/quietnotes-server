const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Quiet Notes Collab Server is running.');
});

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const users = new Map();
const COLORS = ['#e8a87c', '#85dcb8', '#6c82dc', '#e06c75', '#d19a66', '#56b6c2', '#c678dd', '#98c379'];
let colorIndex = 0;

io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);
    
    socket.on('join_collab', ({ username }) => {
        const color = COLORS[colorIndex % COLORS.length];
        colorIndex++;
        
        users.set(socket.id, { username, color, status: 'online', roomId: 'global_room' });
        socket.join('global_room');
        
        socket.to('global_room').emit('user_joined', { id: socket.id, username, color });
        
        const activeUsers = Array.from(users.entries()).map(([id, data]) => ({ id, ...data }));
        socket.emit('init_users', activeUsers);
    });

    socket.on('sync_content', (data) => {
        socket.to('global_room').emit('content_updated', {
            id: socket.id,
            html: data.html
        });
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            console.log(`[-] Disconnected: ${user.username} (${socket.id})`);
            io.to('global_room').emit('user_left', { id: socket.id });
            users.delete(socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`[!] Server listening on port ${PORT}`);
});
