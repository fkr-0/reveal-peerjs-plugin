/**
 * RevealPeerJS - Reveal.js plugin for real-time peer collaboration
 *
 * Uses PeerJS to connect all users visiting a Reveal.js slideshow.
 * First visitor becomes the hub; subsequent visitors join the lobby.
 *
 * Features:
 *  - Lobby panel with user list and chat (public + private)
 *  - Settings modal (username, color, dark mode, high contrast, offline)
 *  - Hub controls (jump all, follow mode, polls, arena)
 *  - Pong mini-game
 *  - Arena top-down shooter mini-game
 */

import { LobbyNetwork } from './networking.js';
import { loadSettings, saveSettings } from './settings.js';
import { injectStyles, removeStyles } from './styles.js';
import { LobbyPanel } from './lobby-panel.js';
import { SettingsModal } from './settings-modal.js';
import { HubMenu } from './hub-menu.js';
import { PongGame } from './pong.js';
import { ArenaGame } from './arena-game.js';
import { CHAT_ICON, USER_ICON, HUB_ICON } from './icons.js';
import { MSG } from './protocol.js';

const RevealPeerJS = () => ({
  id: 'peerjs',

  init(deck) {
    console.log('[RevealPeerJS] Plugin initializing...');
    injectStyles();

    const settings = loadSettings();
    const network = new LobbyNetwork();

    // UI components
    let lobbyPanel = null;
    let settingsModal = null;
    let hubMenu = null;
    let pongGame = null;
    let arenaGame = null;

    // ========== Game lifecycle callbacks ==========
    const gameCallbacks = {
      onStart: () => deck.configure({ keyboard: false }),
      onStop: () => deck.configure({ keyboard: true }),
    };

    // ========== Arena launch handler ==========
    function launchArena() {
      if (arenaGame) {
        arenaGame.stop();
        arenaGame = null;
      }
      const gameConfig = ArenaGame.triggerStart(network);
      arenaGame = new ArenaGame(network, true, gameCallbacks);
      arenaGame.start(gameConfig);
    }

    // ========== Toolbar ==========
    const toolbar = document.createElement('div');
    toolbar.className = 'rpjs-toolbar';
    toolbar.innerHTML = `
      <button id="rpjs-btn-lobby" title="Lobby & Chat">${CHAT_ICON}</button>
      <button id="rpjs-btn-settings" title="Settings">${USER_ICON}</button>
    `;
    console.log('[RevealPeerJS] Creating toolbar and appending to body...');
    document.body.appendChild(toolbar);
    console.log('[RevealPeerJS] Toolbar appended. Visible:', toolbar.offsetParent !== null);

    // ========== Toolbar button events ==========
    document.getElementById('rpjs-btn-lobby').addEventListener('click', () => {
      if (!lobbyPanel) {
        lobbyPanel = new LobbyPanel(network, settings);
      }
      lobbyPanel.toggle();
      document.getElementById('rpjs-btn-lobby').classList.toggle('rpjs-active', lobbyPanel.isVisible());
    });

    document.getElementById('rpjs-btn-settings').addEventListener('click', () => {
      if (!settingsModal) {
        settingsModal = new SettingsModal(network, settings, (newSettings) => {
          Object.assign(settings, newSettings);
        });
      }
      settingsModal.show();
    });

    // ========== Connect to lobby ==========
    network.on('connected', ({ isHub, user }) => {
      console.log(`[RevealPeerJS] Connected as ${isHub ? 'HUB' : 'VISITOR'} (${user.username})`);

      // Update status dot
      const dot = document.getElementById('rpjs-status-dot');
      if (dot) dot.classList.remove('rpjs-connecting', 'rpjs-offline');

      // If hub, show hub button
      if (isHub) {
        const hubBtn = document.createElement('button');
        hubBtn.id = 'rpjs-btn-hub';
        hubBtn.className = 'rpjs-hub-btn';
        hubBtn.title = 'Hub Controls';
        hubBtn.innerHTML = HUB_ICON;
        hubBtn.addEventListener('click', () => {
          if (!hubMenu) {
            hubMenu = new HubMenu(network, deck, launchArena);
          }
          hubMenu.toggle();
        });
        toolbar.appendChild(hubBtn);
      }
    });

    network.on('error', (err) => {
      console.error('[RevealPeerJS] Error:', err);
      const dot = document.getElementById('rpjs-status-dot');
      if (dot) dot.classList.add('rpjs-offline');
    });

    // ========== Network event handlers ==========

    // User list updates
    network.on('user-list', () => {
      if (lobbyPanel) lobbyPanel.updateUsers();
    });

    // Chat messages
    network.on('chat', (msg) => {
      if (lobbyPanel) {
        if (lobbyPanel.isVisible()) {
          lobbyPanel.addChatMessage(msg);
        }
      }
    });

    // Chat history (initial load)
    network.on('chat-history', () => {
      if (lobbyPanel) lobbyPanel.updateChat();
    });

    // Assigned name
    network.on('assigned-name', (name) => {
      settings.username = name;
      saveSettings(settings);
    });

    // Hub: jump slide
    network.on('jump-slide', (payload) => {
      deck.slide(payload.indexh, payload.indexv);
    });

    // Follow mode
    network.on('follow-mode', ({ active }) => {
      if (active) {
        console.log('[RevealPeerJS] Follow mode enabled');
      }
    });

    // Visitor: poll start
    network.on('poll-start', (poll) => {
      _showPollVote(poll);
    });

    // Visitor: poll results
    network.on('poll-results', (results) => {
      _showPollResults(results);
    });

    // Pong invite
    network.on('pong-invite', (payload) => {
      _showPongInvite(payload);
    });

    // Pong accept
    network.on('pong-accept', (payload) => {
      if (payload.to === network.myId) {
        pongGame = new PongGame(network, true, payload.from, gameCallbacks);
        pongGame.start();
      }
    });

    // ========== Arena game event handlers ==========

    // Visitor: arena start (hub triggered)
    network.on('arena-start', (gameConfig) => {
      if (!network.isHub) {
        if (arenaGame) {
          arenaGame.stop();
          arenaGame = null;
        }
        arenaGame = new ArenaGame(network, false, gameCallbacks);
        arenaGame.start(gameConfig);
      }
    });

    // ========== Slide change reporting ==========

    deck.on('slidechanged', () => {
      if (!network.isHub) {
        const indices = deck.getIndices();
        network.reportSlideChange(indices.h, indices.v);
      }
    });

    // ========== Poll vote overlay (for visitors) ==========

    function _showPollVote(poll) {
      const overlay = document.createElement('div');
      overlay.className = 'rpjs-poll-vote-overlay';

      let timeLeft = poll.timeout;
      const startTime = Date.now();
      const totalTime = poll.timeout * 1000;

      overlay.innerHTML = `
        <div class="rpjs-poll-vote-card">
          <div class="rpjs-poll-vote-question">${_escapeHtml(poll.question)}</div>
          <div class="rpjs-poll-vote-options" id="rpjs-vote-options">
            ${poll.answers.map((a, i) => `
              <button class="rpjs-poll-vote-option" data-index="${i}">${_escapeHtml(a)}</button>
            `).join('')}
          </div>
          <div class="rpjs-poll-timer-bar">
            <div class="rpjs-poll-timer-fill" id="rpjs-timer-fill" style="width:100%"></div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Timer
      const timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1 - elapsed / totalTime);
        const fill = overlay.querySelector('#rpjs-timer-fill');
        if (fill) fill.style.width = `${remaining * 100}%`;

        if (elapsed >= totalTime) {
          clearInterval(timerInterval);
          overlay.remove();
        }
      }, 50);

      // Vote option click
      overlay.querySelectorAll('.rpjs-poll-vote-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          const answer = poll.answers[index];
          network.answerPoll(poll.pollId, answer);
          clearInterval(timerInterval);
          overlay.remove();
        });
      });

      // Auto close after timeout + buffer
      setTimeout(() => {
        clearInterval(timerInterval);
        if (overlay.parentNode) overlay.remove();
      }, (poll.timeout + 1) * 1000);
    }

    function _showPollResults(results) {
      const overlay = document.createElement('div');
      overlay.className = 'rpjs-modal-overlay';

      overlay.innerHTML = `
        <div class="rpjs-modal rpjs-poll-results-card">
          <div class="rpjs-modal-title">
            <span>Poll Results</span>
            <button class="rpjs-modal-close" id="rpjs-vresults-close">&times;</button>
          </div>
          <div style="margin-bottom:12px;font-size:14px;color:rgba(255,255,255,0.7)">${_escapeHtml(results.question)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:12px">${results.totalResponses} response${results.totalResponses !== 1 ? 's' : ''}</div>
          ${results.answers.map(a => `
            <div class="rpjs-poll-result-row">
              <div class="rpjs-poll-result-label">
                <span>${_escapeHtml(a.text)}</span>
                <span>${a.count} (${a.percentage}%)</span>
              </div>
              <div class="rpjs-poll-result-bar-bg">
                <div class="rpjs-poll-result-bar-fill" style="width:${a.percentage}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#rpjs-vresults-close').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });

      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 15000);
    }

    function _showPongInvite(payload) {
      const overlay = document.createElement('div');
      overlay.className = 'rpjs-modal-overlay';

      overlay.innerHTML = `
        <div class="rpjs-modal" style="text-align:center">
          <div class="rpjs-modal-title" style="justify-content:center">
            <span>Pong Challenge!</span>
          </div>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:16px">${_escapeHtml(payload.fromUsername)} challenges you to a game of Pong!</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="rpjs-pong-accept" style="padding:8px 20px;background:rgba(76,175,80,0.5);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-family:inherit">Accept</button>
            <button id="rpjs-pong-decline" style="padding:8px 20px;background:rgba(244,67,54,0.3);border:none;border-radius:8px;color:#ef5350;cursor:pointer;font-size:14px;font-family:inherit">Decline</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('#rpjs-pong-accept').addEventListener('click', () => {
        overlay.remove();
        // Send accept
        const acceptMsg = {
          type: MSG.PONG_ACCEPT,
          payload: {
            from: network.myId,
            to: payload.from,
            fromUsername: network.myUser.username,
          },
          timestamp: Date.now(),
        };

        if (network.isHub) {
          network._sendToPeer(payload.from, acceptMsg);
        } else {
          network._sendToPeer(network.lobbyId, acceptMsg);
        }

        pongGame = new PongGame(network, false, payload.from, gameCallbacks);
        pongGame.start();
      });

      overlay.querySelector('#rpjs-pong-decline').addEventListener('click', () => {
        overlay.remove();
        const declineMsg = {
          type: MSG.PONG_DECLINE,
          payload: {
            from: network.myId,
            to: payload.from,
          },
          timestamp: Date.now(),
        };
        if (network.isHub) {
          network._sendToPeer(payload.from, declineMsg);
        } else {
          network._sendToPeer(network.lobbyId, declineMsg);
        }
      });
    }

    function _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // ========== Apply saved settings ==========

    if (settings.darkMode) {
      document.body.classList.add('rpjs-dark-mode');
    }
    if (settings.highContrast) {
      document.body.classList.add('rpjs-high-contrast');
    }

    // ========== Connect! ==========

    network.connect(settings).catch(err => {
      console.error('[RevealPeerJS] Failed to connect:', err);
    });

    // ========== Cleanup on unload ==========

    window.addEventListener('beforeunload', () => {
      network.destroy();
    });

    // ========== Destroy method for Reveal.js ==========

    this.destroy = () => {
      network.destroy();
      if (lobbyPanel) lobbyPanel.destroy();
      if (settingsModal) settingsModal.destroy();
      if (hubMenu) hubMenu.destroy();
      if (pongGame) pongGame.stop();
      if (arenaGame) arenaGame.stop();
      toolbar.remove();
      removeStyles();
    };
  },
});

export default RevealPeerJS;
