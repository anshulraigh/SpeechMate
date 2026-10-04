import 'dotenv/config';

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import agoraAccessToken from 'agora-access-token';

import { buildAiCoachProfile, findBestPair, normalizeUserProfile } from './matchmaker.js';

const { RtcRole, RtcTokenBuilder } = agoraAccessToken;

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const pathname = requestUrl.pathname;

  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'speakmate-backend',
        routes: ['/health', '/api/match', '/api/token', '/api/ai-session'],
      }),
    );
    return;
  }

  if (pathname === '/api/match' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const entry = normalizeUserProfile(payload);
        waitingUsers.set(entry.id, entry);

        const pair = findBestPair([...waitingUsers.values()]);
        if (!pair || pair.a.id === pair.b.id) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'waiting', queueLength: waitingUsers.size }));
          return;
        }

        waitingUsers.delete(pair.a.id);
        waitingUsers.delete(pair.b.id);

        const peerA = {
          id: pair.a.id,
          displayName: pair.a.id,
          avatarEmoji: '🎧',
          englishLevel: pair.a.englishLevel,
          nativeLanguage: pair.a.nativeLanguage,
          practiceGoal: pair.a.practiceGoal,
          interests: pair.a.interests,
        };
        const peerB = {
          id: pair.b.id,
          displayName: pair.b.id,
          avatarEmoji: '🌙',
          englishLevel: pair.b.englishLevel,
          nativeLanguage: pair.b.nativeLanguage,
          practiceGoal: pair.b.practiceGoal,
          interests: pair.b.interests,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'matched',
            match: {
              peer: peerA,
              partner: peerB,
            },
          }),
        );
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request payload' }));
      }
    });
    return;
  }

  if (pathname === '/api/ai-session' && req.method === 'GET') {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const channelName = `speakmate-ai-${Date.now()}`;
    const uid = 1001;
    const aiCoach = buildAiCoachProfile({
      id: 'ai-coach',
      nativeLanguage: 'english',
      practiceGoal: 'dailyConversation',
      interests: ['general'],
    });

    if (!appId || !appCertificate) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'simulated',
          agentName: aiCoach.displayName,
          channelName,
          uid,
          prompt: 'Let’s do a quick English speaking session. Answer in short, natural sentences.',
        }),
      );
      return;
    }

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      3600,
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ready',
        agentName: aiCoach.displayName,
        channelName,
        uid,
        token,
        prompt: 'Let’s do a quick English speaking session. Answer in short, natural sentences.',
      }),
    );
    return;
  }

  if (pathname === '/api/token' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;
        const channelName = payload.channelName ?? 'speakmate-demo';
        const uid = Number(payload.uid ?? 0);
        const role = payload.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

        if (!appId || !appCertificate) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured' }));
          return;
        }

        const token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          uid,
          role,
          3600,
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token request' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const waitingUsers = new Map();

function emitQueueStatus(socket) {
  socket.emit('queue_status', {
    status: 'waiting',
    queueLength: waitingUsers.size,
  });
}

io.on('connection', (socket) => {
  socket.on('join_queue', (profile) => {
    const normalized = normalizeUserProfile({
      ...profile,
      id: profile?.id ?? socket.id,
      socketId: socket.id,
    });

    waitingUsers.set(socket.id, normalized);
    emitQueueStatus(socket);

    const bestPair = findBestPair([...waitingUsers.values()]);
    if (!bestPair) {
      return;
    }

    const { a, b } = bestPair;
    if (a.socketId === socket.id || b.socketId === socket.id) {
      const roomId = `room-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const peerA = io.sockets.sockets.get(a.socketId);
      const peerB = io.sockets.sockets.get(b.socketId);

      if (peerA && peerB) {
        waitingUsers.delete(a.socketId);
        waitingUsers.delete(b.socketId);

        peerA.join(roomId);
        peerB.join(roomId);

        io.to(roomId).emit('match_found', {
          roomId,
          peers: [
            { id: a.id, nativeLanguage: a.nativeLanguage, englishLevel: a.englishLevel },
            { id: b.id, nativeLanguage: b.nativeLanguage, englishLevel: b.englishLevel },
          ],
        });
      }
    }
  });

  socket.on('leave_queue', () => {
    waitingUsers.delete(socket.id);
    socket.emit('queue_status', {
      status: 'idle',
      queueLength: waitingUsers.size,
    });
  });

  socket.on('disconnect', () => {
    waitingUsers.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SpeakMate backend running on http://localhost:${PORT}`);
});
