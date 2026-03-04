import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { parse } from 'url';
import fs from 'fs';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const STORE_FILE = path.join(process.cwd(), 'move-data.json');

// Ensure file exists
if (!fs.existsSync(STORE_FILE)) {
  fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2));
}

// Load initial state
let moveStores: Record<string, { boxes: any[], passcode?: string }> = {};
if (fs.existsSync(STORE_FILE)) {
  try {
    const rawData = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    // Migration: if data is old format (array), convert to new format
    Object.keys(rawData).forEach(key => {
      if (Array.isArray(rawData[key])) {
        moveStores[key] = { boxes: rawData[key] };
      } else {
        moveStores[key] = rawData[key];
      }
    });
  } catch (e) {
    console.error('Failed to load store file', e);
  }
}

const saveStore = () => {
  try {
    const data = JSON.stringify(moveStores, null, 2);
    fs.writeFileSync(STORE_FILE, data);
  } catch (e) {
    console.error('Failed to save store file', e);
  }
};

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 1e7 // 10MB
  });

  io.on('connection', (socket) => {
    socket.on('join-move', ({ moveId, passcode }: { moveId: string, passcode?: string }) => {
      if (!moveStores[moveId]) {
        moveStores[moveId] = { boxes: [] };
      }

      const store = moveStores[moveId];
      
      // If store has a passcode and provided passcode doesn't match
      if (store.passcode && store.passcode !== passcode) {
        socket.emit('auth-error', 'Invalid passcode');
        return;
      }

      socket.join(moveId);
      socket.emit('init-state', { 
        boxes: store.boxes, 
        hasPasscode: !!store.passcode 
      });
    });

    socket.on('set-passcode', ({ moveId, passcode }: { moveId: string, passcode: string }) => {
      if (!moveStores[moveId]) moveStores[moveId] = { boxes: [] };
      moveStores[moveId].passcode = passcode;
      saveStore();
      socket.emit('passcode-set');
      // Notify others in the room that a passcode is now required
      socket.to(moveId).emit('passcode-required');
    });

    socket.on('add-box', ({ moveId, box }: { moveId: string, box: any }) => {
      if (!moveStores[moveId]) moveStores[moveId] = { boxes: [] };
      moveStores[moveId].boxes.push(box);
      saveStore();
      socket.to(moveId).emit('box-added', box);
    });

    socket.on('update-box', ({ moveId, boxId, updates }: { moveId: string, boxId: string, updates: any }) => {
      if (moveStores[moveId]) {
        moveStores[moveId].boxes = moveStores[moveId].boxes.map(b => 
          b.id === boxId ? { ...b, ...updates } : b
        );
        saveStore();
        socket.to(moveId).emit('box-updated', { boxId, updates });
      }
    });

    socket.on('delete-box', ({ moveId, boxId }: { moveId: string, boxId: string }) => {
      if (moveStores[moveId]) {
        moveStores[moveId].boxes = moveStores[moveId].boxes.filter(b => b.id !== boxId);
        saveStore();
        socket.to(moveId).emit('box-deleted', boxId);
      }
    });
  });

  server.get('/api/debug/moves', (req, res) => {
    const summary = Object.keys(moveStores).map(id => ({
      id,
      boxCount: moveStores[id].boxes.length,
      hasPasscode: !!moveStores[id].passcode
    }));
    res.json(summary);
  });

  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const PORT = 3000;
  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
