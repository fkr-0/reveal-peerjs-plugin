/**
 * Hub Menu UI - Hub-specific controls
 */

import { HUB_ICON, JUMP_ICON, FOLLOW_ICON, POLL_ICON, ARENA_ICON, CLOSE_ICON } from './icons.js';

export class HubMenu {
  constructor(network, deck, onLaunchArena) {
    this.network = network;
    this.deck = deck;
    this.onLaunchArena = onLaunchArena;
    this.el = null;
    this.followActive = false;
    this._pollModal = null;
  }

  render() {
    if (this.el) this.el.remove();

    this.el = document.createElement('div');
    this.el.className = 'rpjs-hub-menu';
    this.el.innerHTML = `
      <div class="rpjs-hub-menu-title">Hub Controls</div>
      <div class="rpjs-hub-menu-item" id="rpjs-hub-jump">
        <span class="rpjs-hub-menu-icon">${JUMP_ICON}</span>
        <span class="rpjs-hub-menu-label">Jump All to Current Slide</span>
      </div>
      <div class="rpjs-hub-menu-item" id="rpjs-hub-follow">
        <span class="rpjs-hub-menu-icon">${FOLLOW_ICON}</span>
        <span class="rpjs-hub-menu-label">Follow Mode</span>
        <span class="rpjs-hub-menu-status ${this.followActive ? 'rpjs-on' : ''}" id="rpjs-follow-status">
          ${this.followActive ? 'ON' : 'OFF'}
        </span>
      </div>
      <div class="rpjs-hub-menu-item" id="rpjs-hub-poll">
        <span class="rpjs-hub-menu-icon">${POLL_ICON}</span>
        <span class="rpjs-hub-menu-label">Launch Poll</span>
      </div>
      <div class="rpjs-hub-menu-item" id="rpjs-hub-arena">
        <span class="rpjs-hub-menu-icon">${ARENA_ICON}</span>
        <span class="rpjs-hub-menu-label">Launch Arena</span>
      </div>
    `;

    document.body.appendChild(this.el);
    this._bindEvents();
  }

  _bindEvents() {
    // Jump all
    this.el.querySelector('#rpjs-hub-jump').addEventListener('click', () => {
      const indices = this.deck.getIndices();
      this.network.jumpAllToSlide(indices.h, indices.v);
      this._flashItem('rpjs-hub-jump');
    });

    // Follow mode toggle
    this.el.querySelector('#rpjs-hub-follow').addEventListener('click', () => {
      this.followActive = !this.followActive;
      this.network.setFollowMode(this.followActive);
      const statusEl = this.el.querySelector('#rpjs-follow-status');
      statusEl.textContent = this.followActive ? 'ON' : 'OFF';
      statusEl.className = `rpjs-hub-menu-status ${this.followActive ? 'rpjs-on' : ''}`;
      this.el.querySelector('#rpjs-hub-follow').classList.toggle('rpjs-active-feature', this.followActive);
    });

    // Poll
    this.el.querySelector('#rpjs-hub-poll').addEventListener('click', () => {
      this._showPollCreator();
    });

    // Arena
    this.el.querySelector('#rpjs-hub-arena').addEventListener('click', () => {
      if (this.onLaunchArena) {
        this.onLaunchArena();
      }
      this.hide();
    });
  }

  _flashItem(id) {
    const el = this.el.querySelector(`#${id}`);
    if (!el) return;
    el.style.background = 'rgba(255, 167, 38, 0.2)';
    setTimeout(() => {
      el.style.background = '';
    }, 300);
  }

  _showPollCreator() {
    this._closePollModal();

    const overlay = document.createElement('div');
    overlay.className = 'rpjs-modal-overlay';

    const answers = ['', ''];

    const renderAnswers = (ans) => {
      return ans.map((a, i) => `
        <div class="rpjs-poll-answer-row">
          <input type="text" class="rpjs-poll-answer-input" 
                 data-index="${i}" placeholder="Answer ${i + 1}" value="${this._escapeAttr(a)}">
          ${ans.length > 2 ? `<button class="rpjs-poll-remove-btn" data-remove="${i}">&times;</button>` : ''}
        </div>
      `).join('');
    };

    overlay.innerHTML = `
      <div class="rpjs-modal rpjs-poll-modal">
        <div class="rpjs-modal-title">
          <span>Create Poll</span>
          <button class="rpjs-modal-close" id="rpjs-poll-close">${CLOSE_ICON}</button>
        </div>
        <input type="text" class="rpjs-poll-question-input" id="rpjs-poll-question" 
               placeholder="Enter your question..." maxlength="200">
        <div class="rpjs-poll-answers" id="rpjs-poll-answers">
          ${renderAnswers(answers)}
        </div>
        <button class="rpjs-poll-add-btn" id="rpjs-poll-add-answer">+ Add Answer</button>
        <button class="rpjs-poll-publish-btn" id="rpjs-poll-publish">Publish Poll</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this._pollModal = overlay;

    // Close
    overlay.querySelector('#rpjs-poll-close').addEventListener('click', () => {
      this._closePollModal();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closePollModal();
    });

    // Sync answer inputs
    const syncInputs = () => {
      const inputs = overlay.querySelectorAll('.rpjs-poll-answer-input');
      inputs.forEach(input => {
        const idx = parseInt(input.getAttribute('data-index'));
        if (!isNaN(idx)) answers[idx] = input.value;
      });
    };

    // Remove answer
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('rpjs-poll-remove-btn')) {
        syncInputs();
        const idx = parseInt(e.target.getAttribute('data-remove'));
        answers.splice(idx, 1);
        overlay.querySelector('.rpjs-poll-answers').innerHTML = renderAnswers(answers);
      }
    });

    // Add answer
    overlay.querySelector('#rpjs-poll-add-answer').addEventListener('click', () => {
      syncInputs();
      if (answers.length < 8) {
        answers.push('');
        overlay.querySelector('.rpjs-poll-answers').innerHTML = renderAnswers(answers);
      }
    });

    // Publish
    overlay.querySelector('#rpjs-poll-publish').addEventListener('click', () => {
      syncInputs();
      const question = overlay.querySelector('#rpjs-poll-question').value.trim();
      const validAnswers = answers.map(a => a.trim()).filter(a => a);

      if (!question || validAnswers.length < 2) return;

      const pollId = `poll-${Date.now()}`;
      const poll = {
        pollId,
        question,
        answers: validAnswers,
        fromUsername: this.network.myUser.username,
        timeout: 10,
      };

      this.network.startPoll(poll);
      this._startPollCollector(poll);
      this._closePollModal();
    });
  }

  _startPollCollector(poll) {
    const responses = new Map(); // peerId -> answer
    let timeLeft = poll.timeout;

    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        this._showPollResults(poll, responses);
      }
    }, 1000);

    // Listen for answers
    const answerHandler = (payload) => {
      if (payload.pollId === poll.pollId) {
        responses.set(payload.from, payload.answer);
      }
    };

    this.network.on('poll-answer', answerHandler);

    // Auto cleanup after timeout + buffer
    setTimeout(() => {
      this.network.off('poll-answer', answerHandler);
    }, (poll.timeout + 2) * 1000);
  }

  _showPollResults(poll, responses) {
    const counts = {};
    poll.answers.forEach(a => counts[a] = 0);
    for (const [, answer] of responses) {
      if (counts[answer] !== undefined) counts[answer]++;
    }

    const total = responses.size || 1;

    const results = {
      pollId: poll.pollId,
      question: poll.question,
      answers: poll.answers.map(a => ({
        text: a,
        count: counts[a] || 0,
        percentage: Math.round(((counts[a] || 0) / total) * 100),
      })),
      totalResponses: responses.size,
    };

    // Send results to all visitors
    this.network.sendPollResults(results);

    // Show results locally
    this._renderPollResults(results);
  }

  _renderPollResults(results) {
    const overlay = document.createElement('div');
    overlay.className = 'rpjs-modal-overlay';

    overlay.innerHTML = `
      <div class="rpjs-modal rpjs-poll-results-card">
        <div class="rpjs-modal-title">
          <span>Poll Results</span>
          <button class="rpjs-modal-close" id="rpjs-results-close">${CLOSE_ICON}</button>
        </div>
        <div style="margin-bottom:12px;font-size:14px;color:rgba(255,255,255,0.7)">${this._escapeHtml(results.question)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:12px">${results.totalResponses} response${results.totalResponses !== 1 ? 's' : ''}</div>
        ${results.answers.map(a => `
          <div class="rpjs-poll-result-row">
            <div class="rpjs-poll-result-label">
              <span>${this._escapeHtml(a.text)}</span>
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

    overlay.querySelector('#rpjs-results-close').addEventListener('click', () => {
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  _closePollModal() {
    if (this._pollModal) {
      this._pollModal.remove();
      this._pollModal = null;
    }
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  show() {
    if (!this.el) this.render();
    this.el.style.display = 'block';
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
  }

  toggle() {
    if (this.el && this.el.style.display !== 'none') {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    this._closePollModal();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
