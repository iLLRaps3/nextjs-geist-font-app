const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`Client ${clientId} connected`);

  // Store client connection
  clients.set(clientId, ws);

  // Send current players list to new client
  const players = Array.from(clients.keys()).map(id => ({
    id,
    name: `Player ${id}`,
    level: Math.floor(Math.random() * 10) + 1,
    wanted_level: Math.floor(Math.random() * 5)
  }));
  
  ws.send(JSON.stringify({
    type: 'initial_state',
    data: { players }
  }));

  // Broadcast new player to all other clients
  broadcast({
    type: 'player_join',
    data: {
      id: clientId,
      name: `Player ${clientId}`,
      level: Math.floor(Math.random() * 10) + 1,
      wanted_level: Math.floor(Math.random() * 5)
    }
  }, clientId);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${clientId}:`, data);

      if (data.type === 'commit_crime') {
        // When a player commits a crime, broadcast it to all clients
        const severity = Math.min(5, Math.floor(Math.random() * 3) + 1); // 1-3 severity
        broadcast({
          type: 'crime_event',
          data: {
            crime: data.data.crime,
            location: data.data.location,
            severity,
            perpetrator: clientId,
            perpetratorName: data.data.playerName,
            timestamp: new Date().toISOString()
          }
        });

        // Update player's wanted level
        broadcast({
          type: 'wanted_level_update',
          data: {
            playerId: clientId,
            wantedLevel: Math.min(5, data.data.currentWantedLevel + severity)
          }
        });
      } else {
        // Broadcast other messages to all clients
        broadcast({
          type: data.type,
          data: {
            ...data.data,
            id: clientId
          }
        }, clientId);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected`);
    clients.delete(clientId);

    // Broadcast player leave to all clients
    broadcast({
      type: 'player_leave',
      data: { id: clientId }
    });
  });
});

function broadcast(message, excludeId = null) {
  clients.forEach((client, id) => {
    if (id !== excludeId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

const PORT = 8001;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});
