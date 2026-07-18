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
import { activateModal, setExpanded } from './ui-a11y.js';

const RevealPeerJS = () => ({
  id: 'peerjs',

  init(deck) {
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
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Collaboration tools');
    toolbar.innerHTML = `
      <button id="rpjs-btn-lobby" type="button" title="Lobby & Chat" aria-label="Lobby & Chat"
              aria-controls="rpjs-lobby-panel" aria-expanded="false">${CHAT_ICON}</button>
      <button id="rpjs-btn-settings" type="button" title="Settings" aria-label="Settings" aria-haspopup="dialog" aria-expanded="false">${USER_ICON}</button>
    `;
    document.body.appendChild(toolbar);

    // ========== Toolbar button events ==========
    document.getElementById('rpjs-btn-lobby').addEventListener('click', () => {
      if (!lobbyPanel) {
        lobbyPanel = new LobbyPanel(network, settings, (visible) => {
          const button = document.getElementById('rpjs-btn-lobby');
          setExpanded(button, visible);
          if (!visible) button?.focus();
        });
      }
      lobbyPanel.toggle();
    });

    network.on('pong-end', (payload) => {
      document.querySelectorAll('.rpjs-pong-invite-overlay').forEach((overlay) => {
        if (overlay.dataset.gameId === payload.gameId) {
          if (typeof overlay._rpjsClose === 'function') overlay._rpjsClose();
          else overlay.remove();
        }
      });
    });

    network.on('disconnected', () => {
      if (pongGame) {
        pongGame.stop();
        pongGame = null;
      }
      if (arenaGame) {
        arenaGame.stop();
        arenaGame = null;
      }
    });

    document.getElementById('rpjs-btn-settings').addEventListener('click', () => {
      if (!settingsModal) {
        settingsModal = new SettingsModal(network, settings, (newSettings) => {
          Object.assign(settings, newSettings);
        }, (visible) => {
          setExpanded(document.getElementById('rpjs-btn-settings'), visible);
        });
      }
      settingsModal.show();
    });

    // ========== Connect to lobby ==========
    network.on('connected', ({ isHub, user }) => {
      // Update status dot
      const dot = document.getElementById('rpjs-status-dot');
      if (dot) dot.classList.remove('rpjs-connecting', 'rpjs-offline');
      const status = document.getElementById('rpjs-status-label');
      if (status) status.textContent = 'Connected';

      // If hub, show hub button
      if (isHub) {
        const hubBtn = document.createElement('button');
        hubBtn.id = 'rpjs-btn-hub';
        hubBtn.className = 'rpjs-hub-btn';
        hubBtn.type = 'button';
        hubBtn.title = 'Hub Controls';
        hubBtn.setAttribute('aria-label', 'Hub Controls');
        hubBtn.setAttribute('aria-controls', 'rpjs-hub-menu');
        hubBtn.setAttribute('aria-expanded', 'false');
        hubBtn.innerHTML = HUB_ICON;
        hubBtn.addEventListener('click', () => {
          if (!hubMenu) {
            hubMenu = new HubMenu(network, deck, launchArena, (visible, restoreFocus = true) => {
              setExpanded(hubBtn, visible);
              if (!visible && restoreFocus) hubBtn.focus();
            });
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
      const status = document.getElementById('rpjs-status-label');
      if (status) status.textContent = 'Offline';
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
        pongGame = new PongGame(network, true, payload.from, {
          ...gameCallbacks,
          gameId: payload.gameId,
        });
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

      const mode = poll.mode || 'single';
      const selectedAnswers = new Set();
      const timeout = poll.timeout || 10;
      const startTime = Date.now();
      const totalTime = timeout * 1000;

      overlay.innerHTML = `
        <div class="rpjs-poll-vote-card" role="dialog" aria-modal="true"
             aria-labelledby="rpjs-poll-vote-question" aria-describedby="rpjs-poll-vote-meta rpjs-poll-vote-hint">
          <div class="rpjs-poll-vote-meta" id="rpjs-poll-vote-meta">${_escapeHtml(poll.fromUsername || 'Hub')} asks · ${mode === 'multiple' ? 'multiple choice' : 'single choice'}</div>
          <h2 class="rpjs-poll-vote-question" id="rpjs-poll-vote-question">${_escapeHtml(poll.question)}</h2>
          <div class="rpjs-poll-vote-hint" id="rpjs-poll-vote-hint">${mode === 'multiple' ? 'Select every answer that applies, then submit.' : 'Choose one answer.'}</div>
          <div class="rpjs-poll-vote-options" id="rpjs-vote-options">
            ${poll.answers.map((answer, index) => `
              <button class="rpjs-poll-vote-option" type="button" data-index="${index}" aria-pressed="false">
                <span class="rpjs-poll-vote-option-marker">${mode === 'multiple' ? '□' : '•'}</span>
                <span>${_escapeHtml(answer)}</span>
              </button>
            `).join('')}
          </div>
          ${mode === 'multiple' ? '<button class="rpjs-poll-submit-vote" id="rpjs-poll-submit-vote" type="button" disabled>Submit Vote</button>' : ''}
          <div class="rpjs-poll-timer-bar" role="progressbar" aria-label="Voting time remaining"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
            <div class="rpjs-poll-timer-fill" id="rpjs-timer-fill" style="width:100%"></div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      let deactivate = null;
      let autoCloseTimer = null;

      const close = () => {
        clearInterval(timerInterval);
        clearTimeout(autoCloseTimer);
        deactivate?.();
        deactivate = null;
        if (overlay.parentNode) overlay.remove();
      };
      deactivate = activateModal(overlay, {
        initialFocus: '.rpjs-poll-vote-option',
        onRequestClose: close,
      });

      const submitMultipleVote = () => {
        if (selectedAnswers.size === 0) return;
        network.answerPoll(poll.pollId, [...selectedAnswers]);
        close();
      };

      const updateSubmitState = () => {
        const submit = overlay.querySelector('#rpjs-poll-submit-vote');
        if (submit) submit.disabled = selectedAnswers.size === 0;
      };

      const timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1 - elapsed / totalTime);
        const fill = overlay.querySelector('#rpjs-timer-fill');
        if (fill) fill.style.width = `${remaining * 100}%`;
        const timer = overlay.querySelector('.rpjs-poll-timer-bar');
        if (timer) timer.setAttribute('aria-valuenow', String(Math.round(remaining * 100)));

        if (elapsed >= totalTime) close();
      }, 50);

      overlay.querySelectorAll('.rpjs-poll-vote-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          const answer = poll.answers[index];

          if (mode !== 'multiple') {
            network.answerPoll(poll.pollId, answer);
            close();
            return;
          }

          if (selectedAnswers.has(answer)) {
            selectedAnswers.delete(answer);
            btn.classList.remove('rpjs-selected');
            btn.setAttribute('aria-pressed', 'false');
            const marker = btn.querySelector('.rpjs-poll-vote-option-marker');
            if (marker) marker.textContent = '□';
          } else {
            selectedAnswers.add(answer);
            btn.classList.add('rpjs-selected');
            btn.setAttribute('aria-pressed', 'true');
            const marker = btn.querySelector('.rpjs-poll-vote-option-marker');
            if (marker) marker.textContent = '☑';
          }
          updateSubmitState();
        });
      });

      const submit = overlay.querySelector('#rpjs-poll-submit-vote');
      if (submit) submit.addEventListener('click', submitMultipleVote);

      autoCloseTimer = setTimeout(close, (timeout + 1) * 1000);
    }

    function _showPollResults(results) {
      const overlay = document.createElement('div');
      overlay.className = 'rpjs-modal-overlay';

      const totalResponses = results.totalResponses || 0;
      const totalSelections = results.totalSelections ?? results.answers.reduce((sum, answer) => sum + (answer.count || 0), 0);
      const mode = results.mode || 'single';
      const summaryParts = [
        `${totalResponses} voter${totalResponses === 1 ? '' : 's'}`,
        `${totalSelections} selection${totalSelections === 1 ? '' : 's'}`,
      ];
      if (mode === 'multiple') summaryParts.push('multiple choice');

      const renderResultRow = (answer, index) => {
        const count = answer.count || 0;
        const percentage = Math.max(0, Math.min(100, answer.percentage || 0));
        const rank = answer.rank || index + 1;
        const isWinner = Boolean(answer.isWinner);
        return `
          <div class="rpjs-poll-result-row" data-leading="${isWinner ? 'true' : 'false'}">
            <div class="rpjs-poll-result-heading">
              <span class="rpjs-poll-result-rank">#${rank}</span>
              <span class="rpjs-poll-result-text">${_escapeHtml(answer.text)}</span>
              ${isWinner ? '<span class="rpjs-poll-result-winner">Top choice</span>' : ''}
            </div>
            <div class="rpjs-poll-result-meta">${count} vote${count === 1 ? '' : 's'} · ${percentage}%</div>
            <div class="rpjs-poll-result-bar-bg" role="presentation">
              <div class="rpjs-poll-result-bar-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" style="width:${percentage}%"></div>
            </div>
          </div>
        `;
      };

      overlay.innerHTML = `
        <div class="rpjs-modal rpjs-poll-results-card" role="dialog" aria-modal="true" aria-labelledby="rpjs-visitor-results-title">
          <div class="rpjs-modal-title">
            <h2 id="rpjs-visitor-results-title">Poll Results</h2>
            <button class="rpjs-modal-close" id="rpjs-vresults-close" type="button" aria-label="Close poll results">&times;</button>
          </div>
          <div class="rpjs-poll-results-question">${_escapeHtml(results.question)}</div>
          <div class="rpjs-poll-results-summary">${summaryParts.join(' · ')}</div>
          <div class="rpjs-poll-results-list">
            ${results.answers.map(renderResultRow).join('')}
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      let deactivate = null;
      let autoCloseTimer = null;
      const close = () => {
        clearTimeout(autoCloseTimer);
        deactivate?.();
        deactivate = null;
        overlay.remove();
      };
      deactivate = activateModal(overlay, {
        initialFocus: '#rpjs-vresults-close',
        onRequestClose: close,
      });
      overlay.querySelector('#rpjs-vresults-close').addEventListener('click', close);
      autoCloseTimer = setTimeout(close, 15000);
    }

    function _showPongInvite(payload) {
      const overlay = document.createElement('div');
      overlay.className = 'rpjs-modal-overlay rpjs-pong-invite-overlay';
      overlay.dataset.gameId = payload.gameId;

      overlay.innerHTML = `
        <div class="rpjs-modal rpjs-confirm-dialog" role="alertdialog" aria-modal="true"
             aria-labelledby="rpjs-pong-invite-title" aria-describedby="rpjs-pong-invite-description">
          <div class="rpjs-modal-title rpjs-modal-title-centered">
            <h2 id="rpjs-pong-invite-title">Pong Challenge</h2>
          </div>
          <p class="rpjs-confirm-message" id="rpjs-pong-invite-description">${_escapeHtml(payload.fromUsername)} invited you to play Pong.</p>
          <div class="rpjs-confirm-actions">
            <button class="rpjs-secondary-btn" id="rpjs-pong-decline" type="button">Decline</button>
            <button class="rpjs-primary-btn" id="rpjs-pong-accept" type="button">Accept challenge</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      let deactivate = null;
      const close = () => {
        deactivate?.();
        deactivate = null;
        overlay.remove();
      };
      overlay._rpjsClose = close;
      deactivate = activateModal(overlay, {
        initialFocus: '#rpjs-pong-accept',
        onRequestClose: () => {
          close();
          network.respondToPongInvite(payload, false);
        },
        closeOnBackdrop: false,
      });

      overlay.querySelector('#rpjs-pong-accept').addEventListener('click', () => {
        close();
        network.respondToPongInvite(payload, true);
        pongGame = new PongGame(network, false, payload.from, {
          ...gameCallbacks,
          gameId: payload.gameId,
        });
        pongGame.start();
      });

      overlay.querySelector('#rpjs-pong-decline').addEventListener('click', () => {
        close();
        network.respondToPongInvite(payload, false);
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

    const beforeUnloadHandler = () => this.destroy?.();
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // ========== Destroy method for Reveal.js ==========

    this.destroy = () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      // End active game sessions while the hub connection is still available.
      if (pongGame) pongGame.stop();
      if (arenaGame) arenaGame.stop();
      network.destroy();
      if (lobbyPanel) lobbyPanel.destroy();
      if (settingsModal) settingsModal.destroy();
      if (hubMenu) hubMenu.destroy();
      toolbar.remove();
      removeStyles();
    };
  },
});

export default RevealPeerJS;
