/**
 * Networking module - PeerJS lobby management
 *
 * Architecture:
 * - Star topology: Hub is the central relay
 * - Hub creates a Peer with deterministic ID from URL hash
 * - Visitors connect to the hub
 * - Hub relays messages between all peers
 * - Direct peer connections for pong (low latency)
 */

import Peer from 'peerjs';
import { HUB_AUTHORITATIVE_TYPES, MSG, createMessage } from './protocol.js';

function createSessionId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  const entropy = uuid || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${entropy}`;
}

function normalizeUsername(value, fallback = 'Visitor') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, 64);
  return normalized || fallback;
}

function normalizeColor(value, fallback = '#4fc3f7') {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function normalizeChatText(value) {
  return typeof value === 'string' ? value.slice(0, 4000) : '';
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getLobbyId() {
  const url = window.location.href.split('#')[0]; // ignore fragment
  return `reveal-lobby-${hashString(url)}`;
}

export class LobbyNetwork {
  constructor() {
    this.peer = null;
    this.isHub = false;
    this.lobbyId = getLobbyId();
    this.myId = null;
    this.myUser = null; // { id, username, color, isHub }
    this.users = new Map(); // peerId -> { id, username, color, isHub, conn }
    this.connections = new Map(); // peerId -> DataConnection
    this.chatMessages = [];
    this.followMode = false;
    this.listeners = new Map(); // event -> [callbacks]
    this._visitorCounter = 0;
    this._destroyed = false;
    this._hubSyncSeq = 0;
    this._hubEpoch = createSessionId('hub');
    this._lastHubSyncSeqByType = new Map();
    this._acceptedHubEpochById = new Map();
    this._retiredHubEpochs = new Set();
    this._activePollId = null;
    this._activeArenaId = null;
    this._pongSessions = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const cbs = this.listeners.get(event).filter(cb => cb !== callback);
      this.listeners.set(event, cbs);
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try { cb(data); } catch (e) { console.error('[RevealPeerJS] Listener error:', e); }
      }
    }
  }

  sendArenaLeave(gameId) {
    if (this.isHub || !gameId || gameId !== this._activeArenaId) return;
    this._sendToPeer(this.lobbyId, createMessage(MSG.ARENA_LEAVE, { gameId }));
    this._activeArenaId = null;
  }

  /**
   * Connect to the lobby. First visitor becomes hub.
   */
  connect(settings) {
    return new Promise((resolve, reject) => {
      const username = settings.username || 'Visitor';
      const color = settings.color || '#4fc3f7';

      // Try to become hub first
      const hubPeer = new Peer(this.lobbyId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      let resolved = false;

      hubPeer.on('open', (id) => {
        // We are the hub!
        this.peer = hubPeer;
        this.isHub = true;
        this.myId = id;
        // Assign unique name if using default
        const hubName = username && !username.startsWith('Visitor')
          ? username
          : 'Visitor #1 (Hub)';

        this.myUser = {
          id,
          username: hubName,
          color,
          isHub: true,
          number: 0,
        };
        this.users.set(id, { ...this.myUser, conn: null });
        resolved = true;
        this._emit('connected', { isHub: true, user: this.myUser });
        this._emit('user-list', this.getUserList());
        resolve({ isHub: true });
      });

      hubPeer.on('error', (err) => {
        if (err.type === 'unavailable-id' && !resolved) {
          resolved = true;
          hubPeer.destroy();
          this._connectAsVisitor(username, color).then(resolve).catch(reject);
        } else if (!resolved) {
          this._emit('error', err);
          reject(err);
        }
      });

      // Set timeout - if hub peer doesn't open in 5s, try as visitor
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          hubPeer.destroy();
          this._connectAsVisitor(username, color).then(resolve).catch(reject);
        }
      }, 5000);

      // Hub connection handling
      hubPeer.on('connection', (conn) => {
        this._handleHubConnection(conn);
      });
    });
  }

  _connectAsVisitor(username, color) {
    return new Promise((resolve, reject) => {
      const visitorPeer = new Peer(undefined, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      visitorPeer.on('open', (id) => {
        this.peer = visitorPeer;
        this.isHub = false;
        this.myId = id;

        // Connect to hub
        const conn = visitorPeer.connect(this.lobbyId, { reliable: true });

        conn.on('open', () => {
          this.connections.set(this.lobbyId, conn);

          // Send join message
          conn.send(createMessage(MSG.JOIN, {
            id,
            username,
            color,
            isHub: false,
          }));

          this.myUser = {
            id,
            username,
            color,
            isHub: false,
            number: -1, // will be assigned by hub
          };

          this._emit('connected', { isHub: false, user: this.myUser });
          resolve({ isHub: false });
        });

        conn.on('data', (data) => {
          this._handleIncomingMessage(data, conn, this.lobbyId);
        });

        conn.on('close', () => {
          this._emit('disconnected', { peerId: this.lobbyId });
        });

        conn.on('error', (err) => {
          this._emit('error', err);
        });
      });

      visitorPeer.on('error', (err) => {
        this._emit('error', err);
        reject(err);
      });

      // Unexpected direct connections are retained only for clean shutdown;
      // application messages from them are rejected by _handleIncomingMessage.
      visitorPeer.on('connection', (conn) => {
        this._handleDirectConnection(conn);
      });
    });
  }

  _handleHubConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this._emit('peer-connected', { peerId: conn.peer });
    });

    conn.on('data', (data) => {
      this._handleHubMessage(data, conn);
    });

    conn.on('close', () => {
      const user = this.users.get(conn.peer);
      if (user) {
        this._endPongSessionsForPeer(conn.peer);
        if (this._activeArenaId) {
          this._emit('arena-leave', { gameId: this._activeArenaId, peerId: conn.peer });
        }
        this.users.delete(conn.peer);
        this.connections.delete(conn.peer);
        this._broadcastFromHub(createMessage(MSG.LEAVE, { id: conn.peer, username: user.username }));
        this._emit('user-list', this.getUserList());
        this._emit('peer-disconnected', { peerId: conn.peer, username: user.username });
      }
    });

    conn.on('error', (err) => {
      console.error('[RevealPeerJS] Hub connection error:', err);
    });
  }

  _handleDirectConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      this._handleIncomingMessage(data, conn, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
    });
  }

  /**
   * Hub receives a message from a visitor
   */
  _handleHubMessage(data, fromConn) {
    if (!data || !data.type) return;

    const msg = data;
    if (!msg.payload || typeof msg.payload !== 'object') msg.payload = {};

    switch (msg.type) {
      case MSG.JOIN: {
        const peerId = fromConn.peer;
        if (!peerId || this.users.has(peerId)) break;
        this._visitorCounter++;
        // Always assign a unique name if user hasn't set one
        const requestedName = normalizeUsername(msg.payload.username);
        const assignedName = !requestedName.startsWith('Visitor')
          ? requestedName
          : `Visitor #${this._visitorCounter}`;

        const user = {
          id: peerId,
          username: assignedName,
          color: normalizeColor(msg.payload.color),
          isHub: false,
          number: this._visitorCounter,
          conn: fromConn,
        };
        this.users.set(peerId, user);

        // Send the new user their assigned number and current user list
        fromConn.send(createMessage(MSG.USER_LIST, {
          yourNumber: this._visitorCounter,
          yourAssignedName: user.username,
          users: this.getUserList(),
          chatHistory: this.chatMessages.slice(-50),
        }));

        // Broadcast updated user list to all except the new visitor (who already got theirs)
        this._broadcastFromHub(createMessage(MSG.USER_LIST, {
          users: this.getUserList(),
        }), peerId);

        this._emit('user-list', this.getUserList());
        this._emit('peer-connected', { peerId, username: user.username });
        break;
      }

      case MSG.CHAT: {
        const sender = this.users.get(fromConn.peer);
        if (!sender) break;
        const chatMsg = {
          from: fromConn.peer,
          username: sender.username,
          color: sender.color,
          text: normalizeChatText(msg.payload.text),
          timestamp: msg.timestamp,
          private: false,
        };
        this.chatMessages.push(chatMsg);
        // Relay to all
        this._broadcastFromHub(createMessage(MSG.CHAT, chatMsg));
        this._emit('chat', chatMsg);
        break;
      }

      case MSG.PRIVATE_CHAT: {
        const sender = this.users.get(fromConn.peer);
        if (!sender || !this._isKnownPeer(msg.payload.to)) break;
        const privMsg = {
          from: fromConn.peer,
          to: msg.payload.to,
          username: sender.username,
          color: sender.color,
          text: normalizeChatText(msg.payload.text),
          timestamp: msg.timestamp,
          private: true,
        };
        // Forward to target
        this._sendToPeer(msg.payload.to, createMessage(MSG.PRIVATE_CHAT, privMsg));
        // Also echo back to sender for their UI
        this._emit('chat', privMsg);
        break;
      }

      case MSG.SLIDE_CHANGE: {
        // Visitor reported slide change (for follow mode)
        if (this.followMode && fromConn.peer === this._followTarget) {
          this._broadcastFromHub(createMessage(MSG.JUMP_SLIDE, {
            indexh: msg.payload.indexh,
            indexv: msg.payload.indexv,
          }), fromConn.peer);
        }
        break;
      }

      case MSG.POLL_ANSWER: {
        const sender = this.users.get(fromConn.peer);
        if (!sender || msg.payload.pollId !== this._activePollId) break;
        this._emit('poll-answer', {
          pollId: msg.payload.pollId,
          answer: msg.payload.answer,
          from: fromConn.peer,
          username: sender.username,
        });
        break;
      }

      case MSG.PONG_INVITE: {
        this._handlePongInviteFromPeer(msg.payload, fromConn.peer);
        break;
      }

      case MSG.PONG_MOVE:
      case MSG.PONG_STATE:
      case MSG.PONG_ACCEPT:
      case MSG.PONG_DECLINE:
      case MSG.PONG_SCORE:
      case MSG.PONG_END: {
        this._routePongMessage(msg.type, msg.payload, fromConn.peer);
        break;
      }

      case MSG.ARENA_INPUT:
      case MSG.ARENA_SHOOT: {
        if (!this._activeArenaId || msg.payload.gameId !== this._activeArenaId) break;
        // Inputs are commands for the authoritative hub simulation only.
        // Rebroadcasting commands lets visitors run partial remote simulations
        // and causes divergence from the hub state stream.
        this._emit(msg.type, { ...msg.payload, from: fromConn.peer });
        break;
      }

      case MSG.ARENA_LEAVE: {
        if (!this._activeArenaId || msg.payload.gameId !== this._activeArenaId) break;
        this._emit('arena-leave', {
          gameId: this._activeArenaId,
          peerId: fromConn.peer,
        });
        break;
      }

      case MSG.USERNAME_UPDATE: {
        const u = this.users.get(fromConn.peer);
        if (u) {
          u.username = normalizeUsername(msg.payload.username, u.username);
          u.color = normalizeColor(msg.payload.color, u.color);
          this.users.set(fromConn.peer, u);
          this._broadcastFromHub(createMessage(MSG.USER_LIST, {
            users: this.getUserList(),
          }));
          this._emit('user-list', this.getUserList());
        }
        break;
      }

      default:
        this._emit('raw-message', msg);
    }
  }

  /**
   * Visitor receives a message (from hub or direct peer)
   */
  _handleIncomingMessage(data, conn, fromPeerId) {
    if (!data || !data.type) return;

    const msg = data;
    if (!msg.payload || typeof msg.payload !== 'object') return;

    // The lobby is deliberately hub-centric. Direct PeerJS connections are not
    // trusted as a source of application messages, even if they claim a hub ID.
    if (!this.isHub && fromPeerId !== this.lobbyId) return;

    switch (msg.type) {
      case MSG.USER_LIST: {
        if (msg.payload.yourNumber !== undefined) {
          this.myUser.number = msg.payload.yourNumber;
          if (!this.myUser.username || this.myUser.username.startsWith('slide-visitor')) {
            this.myUser.username = msg.payload.yourAssignedName || `slide-visitor#${msg.payload.yourNumber}`;
          }
          this._emit('assigned-name', this.myUser.username);
        }
        if (msg.payload.users) {
          for (const u of msg.payload.users) {
            if (u.id !== this.myId) {
              this.users.set(u.id, { ...u, conn: null });
            }
          }
          // Remove users not in the list anymore
          const ids = new Set(msg.payload.users.map(u => u.id));
          ids.add(this.myId);
          for (const [id] of this.users) {
            if (!ids.has(id)) this.users.delete(id);
          }
        }
        if (msg.payload.chatHistory) {
          this.chatMessages = msg.payload.chatHistory;
          this._emit('chat-history', msg.payload.chatHistory);
        }
        this._emit('user-list', this.getUserList());
        break;
      }

      case MSG.LEAVE: {
        this.users.delete(msg.payload.id);
        this._emit('user-list', this.getUserList());
        this._emit('peer-disconnected', msg.payload);
        break;
      }

      case MSG.CHAT: {
        this.chatMessages.push(msg.payload);
        this._emit('chat', msg.payload);
        break;
      }

      case MSG.PRIVATE_CHAT: {
        this.chatMessages.push(msg.payload);
        this._emit('chat', msg.payload);
        break;
      }

      case MSG.JUMP_SLIDE: {
        this._emit('jump-slide', msg.payload);
        break;
      }

      case MSG.FOLLOW_MODE: {
        this.followMode = msg.payload.active;
        this._followTarget = msg.payload.target;
        this._emit('follow-mode', msg.payload);
        break;
      }

      case MSG.POLL_START: {
        if (!this._shouldAcceptHubSyncedMessage(msg, fromPeerId, true)) break;
        this._activePollId = msg.payload.pollId;
        this._emit('poll-start', msg.payload);
        break;
      }

      case MSG.POLL_RESULTS: {
        if (!this._shouldAcceptHubSyncedMessage(msg, fromPeerId, true)) break;
        if (this._activePollId && msg.payload.pollId !== this._activePollId) break;
        this._emit('poll-results', msg.payload);
        this._activePollId = null;
        break;
      }

      case MSG.PONG_INVITE:
      case MSG.PONG_MOVE:
      case MSG.PONG_ACCEPT:
      case MSG.PONG_DECLINE:
      case MSG.PONG_STATE:
      case MSG.PONG_SCORE:
      case MSG.PONG_END: {
        if (this._shouldAcceptHubSyncedMessage(msg, fromPeerId, true)) {
          this._emit(msg.type, msg.payload);
        }
        break;
      }

      case MSG.ARENA_START:
      case MSG.ARENA_STATE:
      case MSG.ARENA_HIT:
      case MSG.ARENA_END: {
        if (!this._shouldAcceptHubSyncedMessage(msg, fromPeerId, true)) break;
        if (msg.type === MSG.ARENA_START) {
          this._activeArenaId = msg.payload.gameId;
        } else if (!this._activeArenaId || msg.payload.gameId !== this._activeArenaId) {
          break;
        }
        {
          this._emit(msg.type, msg.payload);
        }
        if (msg.type === MSG.ARENA_END) this._activeArenaId = null;
        break;
      }

      case MSG.ARENA_INPUT:
      case MSG.ARENA_SHOOT: {
        // Visitors never consume command messages; the hub consumes commands and
        // publishes authoritative state snapshots instead.
        break;
      }

      default:
        this._emit('raw-message', msg);
    }
  }

  /**
   * Broadcast a message from hub to all connected visitors
   */
  _broadcastFromHub(msg, excludePeerId = null) {
    for (const [peerId, conn] of this.connections) {
      if (peerId !== excludePeerId && conn && conn.open) {
        try {
          conn.send(msg);
        } catch (e) {
          console.warn('[RevealPeerJS] Failed to send to', peerId, e);
        }
      }
    }
  }

  /**
   * Send message to a specific peer
   */
  _sendToPeer(peerId, msg) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch (e) {
        console.warn('[RevealPeerJS] Failed to send to', peerId, e);
      }
    }
  }

  _isKnownPeer(peerId) {
    return Boolean(peerId) && (peerId === this.myId || this.users.has(peerId));
  }

  _deliverHubMessage(type, payload) {
    const msg = this._createHubMessage(type, payload);
    if (payload.to === this.myId) {
      this._emit(type, msg.payload);
    } else {
      this._sendToPeer(payload.to, msg);
    }
    return msg;
  }

  _endPongSessionsForPeer(peerId) {
    for (const [gameId, session] of this._pongSessions) {
      if (session.initiatorId !== peerId && session.opponentId !== peerId) continue;
      const otherPeerId = session.initiatorId === peerId ? session.opponentId : session.initiatorId;
      this._deliverHubMessage(MSG.PONG_END, {
        gameId,
        from: peerId,
        to: otherPeerId,
        result: { reason: 'peer-disconnected' },
      });
      this._pongSessions.delete(gameId);
    }
  }

  _handlePongInviteFromPeer(requestedPayload, senderId) {
    const sender = this.users.get(senderId);
    const targetId = requestedPayload?.to;
    if (!sender || !this._isKnownPeer(targetId) || targetId === senderId) return null;

    const gameId = requestedPayload.gameId || createSessionId('pong');
    const session = {
      gameId,
      initiatorId: senderId,
      opponentId: targetId,
      status: 'pending',
    };
    this._pongSessions.set(gameId, session);

    return this._deliverHubMessage(MSG.PONG_INVITE, {
      gameId,
      from: senderId,
      fromUsername: sender.username,
      to: targetId,
    });
  }

  _routePongMessage(type, requestedPayload, senderId) {
    const gameId = requestedPayload?.gameId;
    const session = this._pongSessions.get(gameId);
    if (!session) return null;

    const isInitiator = senderId === session.initiatorId;
    const isOpponent = senderId === session.opponentId;
    if (!isInitiator && !isOpponent) return null;

    const expectedTarget = isInitiator ? session.opponentId : session.initiatorId;
    if (requestedPayload.to !== expectedTarget) return null;

    if (type === MSG.PONG_ACCEPT || type === MSG.PONG_DECLINE) {
      if (!isOpponent || session.status !== 'pending') return null;
      session.status = type === MSG.PONG_ACCEPT ? 'active' : 'declined';
    } else {
      if (session.status !== 'active') return null;
      if ([MSG.PONG_STATE, MSG.PONG_SCORE].includes(type) && !isInitiator) return null;
    }

    const payload = {
      ...requestedPayload,
      gameId,
      from: senderId,
      to: expectedTarget,
    };
    const msg = this._deliverHubMessage(type, payload);

    if (type === MSG.PONG_DECLINE || type === MSG.PONG_END) {
      this._pongSessions.delete(gameId);
    }
    return msg;
  }


  _createHubMessage(type, payload = {}) {
    return createMessage(type, {
      ...payload,
      hubSync: {
        hubId: this.myId,
        epoch: this._hubEpoch,
        seq: ++this._hubSyncSeq,
      },
    });
  }

  _shouldAcceptHubSyncedMessage(msg, fromPeerId = null, required = false) {
    const hubSync = msg?.payload?.hubSync;
    const mustBeAuthoritative = required || HUB_AUTHORITATIVE_TYPES.has(msg?.type);
    if (!hubSync || typeof hubSync.seq !== 'number') return !mustBeAuthoritative;

    const expectedHubId = this.lobbyId;
    const hubId = hubSync.hubId || 'unknown-hub';
    if (!this.isHub && expectedHubId && hubId !== expectedHubId) return false;
    if (!this.isHub && fromPeerId && fromPeerId !== expectedHubId) return false;

    const epoch = hubSync.epoch;
    if (typeof epoch !== 'string' || !epoch) return false;
    const epochKey = `${hubId}:${epoch}`;
    if (this._retiredHubEpochs.has(epochKey)) return false;

    const acceptedEpoch = this._acceptedHubEpochById.get(hubId);
    if (acceptedEpoch && acceptedEpoch !== epoch) {
      this._retiredHubEpochs.add(`${hubId}:${acceptedEpoch}`);
    }
    this._acceptedHubEpochById.set(hubId, epoch);

    const key = `${msg.type}:${hubId}:${epoch}`;
    const lastSeq = this._lastHubSyncSeqByType.get(key) || 0;
    if (hubSync.seq <= lastSeq) return false;

    this._lastHubSyncSeqByType.set(key, hubSync.seq);
    return true;
  }

  /**
   * Public: Send a chat message to the lobby
   */
  sendChat(text, targetPeerId = null) {
    const chatPayload = {
      from: this.myId,
      username: this.myUser.username,
      color: this.myUser.color,
      text,
    };

    if (this.isHub) {
      if (targetPeerId) {
        // Private from hub
        const privMsg = {
          ...chatPayload,
          to: targetPeerId,
          private: true,
        };
        this.chatMessages.push(privMsg);
        this._sendToPeer(targetPeerId, createMessage(MSG.PRIVATE_CHAT, privMsg));
        this._emit('chat', privMsg);
      } else {
        const msg = { ...chatPayload, private: false };
        this.chatMessages.push(msg);
        this._broadcastFromHub(createMessage(MSG.CHAT, msg));
        this._emit('chat', msg);
      }
    } else {
      // Send to hub for relay
      if (targetPeerId) {
        this._sendToPeer(this.lobbyId, createMessage(MSG.PRIVATE_CHAT, {
          ...chatPayload,
          to: targetPeerId,
        }));
      } else {
        this._sendToPeer(this.lobbyId, createMessage(MSG.CHAT, chatPayload));
      }
    }
  }

  /**
   * Public: Hub broadcasts jump-slide command
   */
  jumpAllToSlide(indexh, indexv) {
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.JUMP_SLIDE, { indexh, indexv }));
  }

  /**
   * Public: Hub toggles follow mode
   */
  setFollowMode(active, target = null) {
    if (!this.isHub) return;
    this.followMode = active;
    this._followTarget = target;
    this._broadcastFromHub(createMessage(MSG.FOLLOW_MODE, { active, target }));
    this._emit('follow-mode', { active, target });
  }

  /**
   * Public: Hub starts a poll
   */
  startPoll(poll) {
    if (!this.isHub || !poll?.pollId) return;
    this._activePollId = poll.pollId;
    const msg = this._createHubMessage(MSG.POLL_START, poll);
    this._broadcastFromHub(msg);
    this._emit('poll-start', msg.payload);
  }

  /**
   * Public: Visitor answers a poll
   */
  answerPoll(pollId, answer) {
    if (!pollId || (this._activePollId && pollId !== this._activePollId)) return;
    const msg = createMessage(MSG.POLL_ANSWER, {
      pollId,
      answer,
      from: this.myId,
      username: this.myUser.username,
    });

    if (this.isHub) {
      this._emit('poll-answer', msg.payload);
    } else {
      this._sendToPeer(this.lobbyId, msg);
    }
  }

  /**
   * Public: Send poll results to all
   */
  sendPollResults(results) {
    if (!this.isHub || !results?.pollId || results.pollId !== this._activePollId) return;
    const msg = this._createHubMessage(MSG.POLL_RESULTS, results);
    this._broadcastFromHub(msg);
    this._emit('poll-results', msg.payload);
    this._activePollId = null;
  }

  closePoll(pollId) {
    if (!this.isHub || pollId !== this._activePollId) return false;
    this._activePollId = null;
    return true;
  }

  /**
   * Public: Report local slide change
   */
  reportSlideChange(indexh, indexv) {
    if (this.isHub) return; // Hub doesn't need to report to itself
    this._sendToPeer(this.lobbyId, createMessage(MSG.SLIDE_CHANGE, {
      from: this.myId,
      indexh,
      indexv,
    }));
  }

  /**
   * Public: Update username/color
   */
  updateProfile(username, color) {
    this.myUser.username = username;
    this.myUser.color = color;

    if (this.isHub) {
      const u = this.users.get(this.myId);
      if (u) {
        u.username = username;
        u.color = color;
      }
      this._broadcastFromHub(createMessage(MSG.USER_LIST, {
        users: this.getUserList(),
      }));
      this._emit('user-list', this.getUserList());
    } else {
      this._sendToPeer(this.lobbyId, createMessage(MSG.USERNAME_UPDATE, {
        id: this.myId,
        username,
        color,
      }));
    }
  }

  /**
   * Public: Send pong invite
   */
  sendPongInvite(targetPeerId) {
    if (!this._isKnownPeer(targetPeerId) || targetPeerId === this.myId) return null;
    const gameId = createSessionId('pong');
    const payload = {
      gameId,
      from: this.myId,
      fromUsername: this.myUser.username,
      to: targetPeerId,
    };

    if (this.isHub) {
      this._pongSessions.set(gameId, {
        gameId,
        initiatorId: this.myId,
        opponentId: targetPeerId,
        status: 'pending',
      });
      this._deliverHubMessage(MSG.PONG_INVITE, payload);
    } else {
      this._sendToPeer(this.lobbyId, createMessage(MSG.PONG_INVITE, payload));
    }
    return gameId;
  }

  respondToPongInvite(invite, accepted) {
    if (!invite?.gameId || invite.to !== this.myId) return;
    const type = accepted ? MSG.PONG_ACCEPT : MSG.PONG_DECLINE;
    const payload = {
      gameId: invite.gameId,
      from: this.myId,
      fromUsername: this.myUser.username,
      to: invite.from,
    };
    if (this.isHub) {
      return this._routePongMessage(type, payload, this.myId);
    }
    this._sendToPeer(this.lobbyId, createMessage(type, payload));
  }

  /**
   * Public: Send pong move
   */
  sendPongMove(targetPeerId, y, gameId) {
    const payload = {
      gameId,
      from: this.myId,
      to: targetPeerId,
      y,
    };

    if (this.isHub) {
      this._routePongMessage(MSG.PONG_MOVE, payload, this.myId);
    } else {
      this._sendToPeer(this.lobbyId, createMessage(MSG.PONG_MOVE, payload));
    }
  }

  /**
   * Public: Send authoritative pong state through the hub relay
   */
  sendPongState(targetPeerId, state, gameId) {
    const payload = {
      gameId,
      from: this.myId,
      to: targetPeerId,
      state,
    };

    if (this.isHub) {
      this._routePongMessage(MSG.PONG_STATE, payload, this.myId);
    } else {
      this._sendToPeer(this.lobbyId, createMessage(MSG.PONG_STATE, payload));
    }
  }

  sendPongEnd(targetPeerId, result, gameId) {
    const payload = { gameId, from: this.myId, to: targetPeerId, result };
    if (this.isHub) {
      this._routePongMessage(MSG.PONG_END, payload, this.myId);
    } else {
      this._sendToPeer(this.lobbyId, createMessage(MSG.PONG_END, payload));
    }
  }

  /**
   * Public: Hub starts an arena game
   */
  startArena(gameConfig) {
    if (!this.isHub || !gameConfig?.gameId) return;
    this._activeArenaId = gameConfig.gameId;
    const msg = this._createHubMessage(MSG.ARENA_START, gameConfig);
    this._broadcastFromHub(msg);
    this._emit('arena-start', msg.payload);
  }

  /**
   * Public: Hub broadcasts arena state
   */
  broadcastArenaState(state) {
    if (!this.isHub || state?.gameId !== this._activeArenaId) return;
    const msg = this._createHubMessage(MSG.ARENA_STATE, state);
    this._broadcastFromHub(msg);
    // Also emit locally for hub's own game
    this._emit('arena-state', msg.payload);
  }

  /**
   * Public: Send arena input (movement) to hub
   */
  sendArenaInput(input) {
    if (!input?.gameId || input.gameId !== this._activeArenaId) return;
    const msg = createMessage(MSG.ARENA_INPUT, {
      from: this.myId,
      ...input,
    });
    if (this.isHub) {
      this._emit('arena-input', { ...input, from: this.myId });
    } else {
      this._sendToPeer(this.lobbyId, msg);
    }
  }

  /**
   * Public: Send arena shoot to hub
   */
  sendArenaShoot(shoot) {
    if (!shoot?.gameId || shoot.gameId !== this._activeArenaId) return;
    const msg = createMessage(MSG.ARENA_SHOOT, {
      from: this.myId,
      ...shoot,
    });
    if (this.isHub) {
      this._emit('arena-shoot', { ...shoot, from: this.myId });
    } else {
      this._sendToPeer(this.lobbyId, msg);
    }
  }

  /**
   * Public: Hub broadcasts arena hit
   */
  broadcastArenaHit(hit) {
    if (!this.isHub || !this._activeArenaId) return;
    const msg = this._createHubMessage(MSG.ARENA_HIT, {
      ...hit,
      gameId: hit.gameId || this._activeArenaId,
    });
    this._broadcastFromHub(msg);
    this._emit('arena-hit', msg.payload);
  }

  /**
   * Public: Hub broadcasts arena end
   */
  broadcastArenaEnd(results) {
    if (!this.isHub || results?.gameId !== this._activeArenaId) return;
    const msg = this._createHubMessage(MSG.ARENA_END, results);
    this._broadcastFromHub(msg);
    this._emit('arena-end', msg.payload);
    this._activeArenaId = null;
  }

  /**
   * Public: Get user list (for display)
   */
  getUserList() {
    const list = [];
    let selfIncluded = false;
    for (const [id, user] of this.users) {
      if (id === this.myId) selfIncluded = true;
      list.push({
        id: user.id,
        username: user.username,
        color: user.color,
        isHub: user.isHub,
        number: user.number,
      });
    }
    if (!selfIncluded && this.myUser) {
      list.push({
        id: this.myUser.id,
        username: this.myUser.username,
        color: this.myUser.color,
        isHub: this.myUser.isHub,
        number: this.myUser.number,
      });
    }
    return list.sort((a, b) => {
      if (a.isHub && !b.isHub) return -1;
      if (!a.isHub && b.isHub) return 1;
      return (a.number || 0) - (b.number || 0);
    });
  }

  /**
   * Public: Go offline / come back online
   */
  goOffline() {
    if (this.peer && !this.peer.destroyed) {
      if (this.isHub) {
        // Hub can't really go offline without killing the lobby
        // Just mark as offline
        this.myUser._offline = true;
      } else {
        this.peer.disconnect();
      }
    }
  }

  goOnline() {
    if (this.peer && this.peer.disconnected) {
      this.peer.reconnect();
    }
    this.myUser._offline = false;
  }

  /**
   * Public: Destroy and clean up
   */
  destroy() {
    this._destroyed = true;
    if (this.peer) {
      // Notify others we're leaving
      if (!this.isHub) {
        try {
          this._sendToPeer(this.lobbyId, createMessage(MSG.LEAVE, {
            id: this.myId,
            username: this.myUser.username,
          }));
        } catch (e) { /* ignore */ }
      }
      this.peer.destroy();
    }
    this.connections.clear();
    this.users.clear();
    this.listeners.clear();
  }
}
