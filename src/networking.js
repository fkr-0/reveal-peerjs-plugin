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
import { MSG, createMessage } from './protocol.js';

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

      // Visitor can also receive direct connections (for pong)
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

    switch (msg.type) {
      case MSG.JOIN: {
        this._visitorCounter++;
        // Always assign a unique name if user hasn't set one
        const assignedName = msg.payload.username && !msg.payload.username.startsWith('Visitor')
          ? msg.payload.username
          : `Visitor #${this._visitorCounter}`;

        const user = {
          id: msg.payload.id,
          username: assignedName,
          color: msg.payload.color || '#4fc3f7',
          isHub: false,
          number: this._visitorCounter,
          conn: fromConn,
        };
        this.users.set(msg.payload.id, user);

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
        }), msg.payload.id);

        this._emit('user-list', this.getUserList());
        this._emit('peer-connected', { peerId: msg.payload.id, username: user.username });
        break;
      }

      case MSG.CHAT: {
        const chatMsg = {
          from: msg.payload.from || fromConn.peer,
          username: msg.payload.username,
          color: msg.payload.color,
          text: msg.payload.text,
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
        const privMsg = {
          from: msg.payload.from || fromConn.peer,
          to: msg.payload.to,
          username: msg.payload.username,
          color: msg.payload.color,
          text: msg.payload.text,
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
        if (this.followMode && msg.payload.from === this._followTarget) {
          this._broadcastFromHub(createMessage(MSG.JUMP_SLIDE, {
            indexh: msg.payload.indexh,
            indexv: msg.payload.indexv,
          }), fromConn.peer);
        }
        break;
      }

      case MSG.POLL_ANSWER: {
        this._emit('poll-answer', msg.payload);
        break;
      }

      case MSG.PONG_MOVE:
      case MSG.PONG_ACCEPT:
      case MSG.PONG_DECLINE: {
        // Forward pong messages to target peer
        if (msg.payload && msg.payload.to) {
          this._sendToPeer(msg.payload.to, msg);
        }
        this._emit(msg.type, msg.payload);
        break;
      }

      case MSG.ARENA_INPUT:
      case MSG.ARENA_SHOOT: {
        // Arena input/shoot from visitor → broadcast to all (including hub processing)
        this._emit(msg.type, { ...msg.payload, from: fromConn.peer });
        // Also relay to all other visitors
        this._broadcastFromHub(createMessage(msg.type, { ...msg.payload, from: fromConn.peer }), fromConn.peer);
        break;
      }

      case MSG.USERNAME_UPDATE: {
        const u = this.users.get(msg.payload.id);
        if (u) {
          u.username = msg.payload.username;
          u.color = msg.payload.color;
          this.users.set(msg.payload.id, u);
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
        this._emit('poll-start', msg.payload);
        break;
      }

      case MSG.POLL_RESULTS: {
        this._emit('poll-results', msg.payload);
        break;
      }

      case MSG.PONG_INVITE:
      case MSG.PONG_MOVE:
      case MSG.PONG_ACCEPT:
      case MSG.PONG_DECLINE:
      case MSG.PONG_STATE:
      case MSG.PONG_SCORE:
      case MSG.PONG_END: {
        this._emit(msg.type, msg.payload);
        break;
      }

      case MSG.ARENA_START:
      case MSG.ARENA_STATE:
      case MSG.ARENA_INPUT:
      case MSG.ARENA_SHOOT:
      case MSG.ARENA_HIT:
      case MSG.ARENA_END: {
        this._emit(msg.type, msg.payload);
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
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.POLL_START, poll));
    this._emit('poll-start', poll);
  }

  /**
   * Public: Visitor answers a poll
   */
  answerPoll(pollId, answer) {
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
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.POLL_RESULTS, results));
    this._emit('poll-results', results);
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
    const msg = createMessage(MSG.PONG_INVITE, {
      from: this.myId,
      fromUsername: this.myUser.username,
      to: targetPeerId,
    });

    if (this.isHub) {
      this._sendToPeer(targetPeerId, msg);
    } else {
      this._sendToPeer(this.lobbyId, msg);
    }
  }

  /**
   * Public: Send pong move
   */
  sendPongMove(targetPeerId, y) {
    const msg = createMessage(MSG.PONG_MOVE, {
      from: this.myId,
      to: targetPeerId,
      y,
    });

    if (this.isHub) {
      this._sendToPeer(targetPeerId, msg);
    } else {
      this._sendToPeer(this.lobbyId, msg);
    }
  }

  /**
   * Public: Hub starts an arena game
   */
  startArena(gameConfig) {
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.ARENA_START, gameConfig));
    this._emit('arena-start', gameConfig);
  }

  /**
   * Public: Hub broadcasts arena state
   */
  broadcastArenaState(state) {
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.ARENA_STATE, state));
    // Also emit locally for hub's own game
    this._emit('arena-state', state);
  }

  /**
   * Public: Send arena input (movement) to hub
   */
  sendArenaInput(input) {
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
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.ARENA_HIT, hit));
    this._emit('arena-hit', hit);
  }

  /**
   * Public: Hub broadcasts arena end
   */
  broadcastArenaEnd(results) {
    if (!this.isHub) return;
    this._broadcastFromHub(createMessage(MSG.ARENA_END, results));
    this._emit('arena-end', results);
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
