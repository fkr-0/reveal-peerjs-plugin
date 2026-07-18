/**
 * Hub Menu UI - Hub-specific controls
 */

import { HUB_ICON, JUMP_ICON, FOLLOW_ICON, POLL_ICON, ARENA_ICON, CLOSE_ICON } from './icons.js';
import { activateModal } from './ui-a11y.js';

export class HubMenu {
  constructor(network, deck, onLaunchArena, onVisibilityChange = null) {
    this.network = network;
    this.deck = deck;
    this.onLaunchArena = onLaunchArena;
    this.onVisibilityChange = onVisibilityChange;
    this.el = null;
    this.followActive = false;
    this._pollModal = null;
    this._deactivatePollModal = null;
    this._keyHandler = null;
    this._outsideClickHandler = null;
    this._outsideClickTimer = null;
  }

  render() {
    if (this.el) this.el.remove();

    this.el = document.createElement('div');
    this.el.className = 'rpjs-hub-menu';
    this.el.id = 'rpjs-hub-menu';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-labelledby', 'rpjs-hub-menu-title');
    this.el.innerHTML = `
      <h2 class="rpjs-hub-menu-title" id="rpjs-hub-menu-title">Hub Controls</h2>
      <button class="rpjs-hub-menu-item" id="rpjs-hub-jump" type="button">
        <span class="rpjs-hub-menu-icon">${JUMP_ICON}</span>
        <span class="rpjs-hub-menu-copy">
          <span class="rpjs-hub-menu-label">Jump All to Current Slide</span>
          <span class="rpjs-hub-menu-description">Bring everyone to this slide once.</span>
        </span>
      </button>
      <button class="rpjs-hub-menu-item" id="rpjs-hub-follow" type="button" aria-pressed="${this.followActive ? 'true' : 'false'}">
        <span class="rpjs-hub-menu-icon">${FOLLOW_ICON}</span>
        <span class="rpjs-hub-menu-copy">
          <span class="rpjs-hub-menu-label">Follow Mode</span>
          <span class="rpjs-hub-menu-description">Keep everyone synced as you navigate.</span>
        </span>
        <span class="rpjs-hub-menu-status ${this.followActive ? 'rpjs-on' : ''}" id="rpjs-follow-status">
          ${this.followActive ? 'ON' : 'OFF'}
        </span>
      </button>
      <button class="rpjs-hub-menu-item" id="rpjs-hub-poll" type="button">
        <span class="rpjs-hub-menu-icon">${POLL_ICON}</span>
        <span class="rpjs-hub-menu-copy">
          <span class="rpjs-hub-menu-label">Launch Poll</span>
          <span class="rpjs-hub-menu-description">Ask a timed question and share results.</span>
        </span>
      </button>
      <button class="rpjs-hub-menu-item" id="rpjs-hub-arena" type="button">
        <span class="rpjs-hub-menu-icon">${ARENA_ICON}</span>
        <span class="rpjs-hub-menu-copy">
          <span class="rpjs-hub-menu-label">Launch Arena</span>
          <span class="rpjs-hub-menu-description">Start a game for everyone in the lobby.</span>
        </span>
      </button>
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
      const followBtn = this.el.querySelector('#rpjs-hub-follow');
      followBtn.classList.toggle('rpjs-active-feature', this.followActive);
      followBtn.setAttribute('aria-pressed', this.followActive ? 'true' : 'false');
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
      this.hide(false);
    });

    this._keyHandler = (event) => {
      if (event.key === 'Escape' && this.el?.style.display !== 'none' && !this._pollModal) {
        event.preventDefault();
        this.hide(true);
      }
    };
    this.el.addEventListener('keydown', this._keyHandler);

    this._outsideClickHandler = (event) => {
      if (event.target.closest?.('#rpjs-btn-hub')) return;
      if (this.el?.style.display !== 'none' && !this.el.contains(event.target) && !this._pollModal) {
        this.hide(false);
      }
    };
    this._outsideClickTimer = setTimeout(() => {
      this._outsideClickTimer = null;
      document.addEventListener('click', this._outsideClickHandler);
    }, 0);
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
                 data-index="${i}" placeholder="Answer ${i + 1}" value="${this._escapeAttr(a)}"
                 aria-label="Answer ${i + 1}" autocomplete="off">
          ${ans.length > 2 ? `<button class="rpjs-poll-remove-btn" type="button" data-remove="${i}" aria-label="Remove answer ${i + 1}">&times;</button>` : ''}
        </div>
      `).join('');
    };

    overlay.innerHTML = `
      <div class="rpjs-modal rpjs-poll-modal" role="dialog" aria-modal="true" aria-labelledby="rpjs-poll-title" aria-describedby="rpjs-poll-error">
        <div class="rpjs-modal-title">
          <h2 id="rpjs-poll-title">Create Poll</h2>
          <button class="rpjs-modal-close" id="rpjs-poll-close" type="button" aria-label="Close poll creator">${CLOSE_ICON}</button>
        </div>
        <label class="rpjs-field-label" for="rpjs-poll-question">Question</label>
        <input type="text" class="rpjs-poll-question-input" id="rpjs-poll-question"
               placeholder="What would you like to ask?" maxlength="200" autocomplete="off">
        <div class="rpjs-field-label" id="rpjs-poll-answers-label">Answers</div>
        <div class="rpjs-poll-answers" id="rpjs-poll-answers">
          ${renderAnswers(answers)}
        </div>
        <button class="rpjs-poll-add-btn" id="rpjs-poll-add-answer" type="button">+ Add Answer</button>
        <div class="rpjs-poll-options-panel" aria-label="Poll options">
          <label class="rpjs-poll-option-field" for="rpjs-poll-timeout">
            <span>Voting time</span>
            <select id="rpjs-poll-timeout" class="rpjs-poll-select">
              <option value="10">10 seconds</option>
              <option value="20">20 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </label>
          <label class="rpjs-poll-check-option">
            <input type="checkbox" id="rpjs-poll-mode-multiple">
            <span>Allow multiple answers</span>
          </label>
          <label class="rpjs-poll-check-option">
            <input type="checkbox" id="rpjs-poll-share-results" checked>
            <span>Share results with visitors</span>
          </label>
        </div>
        <div class="rpjs-field-error" id="rpjs-poll-error" role="alert" aria-live="polite"></div>
        <button class="rpjs-poll-publish-btn" id="rpjs-poll-publish" type="button" disabled>Publish Poll</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this._pollModal = overlay;
    this._deactivatePollModal = activateModal(overlay, {
      initialFocus: '#rpjs-poll-question',
      onRequestClose: () => this._closePollModal(),
    });

    // Close
    overlay.querySelector('#rpjs-poll-close').addEventListener('click', () => {
      this._closePollModal();
    });
    // Sync answer inputs
    const syncInputs = () => {
      const inputs = overlay.querySelectorAll('.rpjs-poll-answer-input');
      inputs.forEach(input => {
        const idx = parseInt(input.getAttribute('data-index'));
        if (!isNaN(idx)) answers[idx] = input.value;
      });
    };
    const updatePublishState = () => {
      syncInputs();
      const question = overlay.querySelector('#rpjs-poll-question').value.trim();
      const validAnswers = answers.map(answer => answer.trim()).filter(Boolean);
      const publish = overlay.querySelector('#rpjs-poll-publish');
      publish.disabled = !question || validAnswers.length < 2;
      if (!publish.disabled) overlay.querySelector('#rpjs-poll-error').textContent = '';
    };
    overlay.addEventListener('input', updatePublishState);

    // Remove answer
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('rpjs-poll-remove-btn')) {
        syncInputs();
        const idx = parseInt(e.target.getAttribute('data-remove'));
        answers.splice(idx, 1);
        overlay.querySelector('.rpjs-poll-answers').innerHTML = renderAnswers(answers);
        updatePublishState();
      }
    });

    // Add answer
    overlay.querySelector('#rpjs-poll-add-answer').addEventListener('click', () => {
      syncInputs();
      if (answers.length < 8) {
        answers.push('');
        overlay.querySelector('.rpjs-poll-answers').innerHTML = renderAnswers(answers);
        updatePublishState();
      }
    });

    // Publish
    overlay.querySelector('#rpjs-poll-publish').addEventListener('click', () => {
      syncInputs();
      const question = overlay.querySelector('#rpjs-poll-question').value.trim();
      const validAnswers = answers.map(a => a.trim()).filter(a => a);
      const timeout = parseInt(overlay.querySelector('#rpjs-poll-timeout').value, 10) || 10;
      const mode = overlay.querySelector('#rpjs-poll-mode-multiple').checked ? 'multiple' : 'single';
      const shareResults = overlay.querySelector('#rpjs-poll-share-results').checked;

      if (!question || validAnswers.length < 2) {
        overlay.querySelector('#rpjs-poll-error').textContent = 'Add a question and at least two answers.';
        return;
      }

      const pollId = `poll-${Date.now()}`;
      const poll = {
        pollId,
        question,
        answers: validAnswers,
        fromUsername: this.network.myUser.username,
        timeout,
        mode,
        shareResults,
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
    const results = this._buildPollResults(poll, responses);

    if (poll.shareResults !== false) {
      this.network.sendPollResults(results);
    } else {
      this.network.closePoll?.(poll.pollId);
    }

    this._renderPollResults(results);
  }

  _buildPollResults(poll, responses) {
    const counts = new Map(poll.answers.map(answer => [answer, 0]));
    const allowedAnswers = new Set(poll.answers);
    const mode = poll.mode || 'single';
    let totalSelections = 0;

    for (const [, rawAnswer] of responses) {
      const answers = this._normalizePollAnswer(rawAnswer, allowedAnswers, mode);

      for (const answer of answers) {
        counts.set(answer, counts.get(answer) + 1);
        totalSelections++;
      }
    }

    const totalResponses = responses.size;
    const denominator = Math.max(1, totalResponses);
    const rankedAnswers = poll.answers
      .map((text, index) => ({
        text,
        index,
        count: counts.get(text) || 0,
      }))
      .sort((a, b) => b.count - a.count || a.index - b.index);
    const winningCount = rankedAnswers[0]?.count || 0;

    return {
      pollId: poll.pollId,
      question: poll.question,
      mode: poll.mode || 'single',
      shareResults: poll.shareResults !== false,
      totalResponses,
      totalSelections,
      answers: rankedAnswers.map((answer, index) => ({
        text: answer.text,
        count: answer.count,
        percentage: Math.round((answer.count / denominator) * 100),
        rank: index + 1,
        isWinner: winningCount > 0 && answer.count === winningCount,
      })),
    };
  }

  _normalizePollAnswer(rawAnswer, allowedAnswers, mode) {
    const submitted = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    const uniqueValid = [];

    for (const answer of submitted) {
      const normalized = String(answer).trim();
      if (!normalized || !allowedAnswers.has(normalized) || uniqueValid.includes(normalized)) continue;
      uniqueValid.push(normalized);
      if (mode !== 'multiple') break;
    }

    return uniqueValid;
  }

  _renderPollResults(results) {
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

    overlay.innerHTML = `
      <div class="rpjs-modal rpjs-poll-results-card" role="dialog" aria-modal="true" aria-labelledby="rpjs-host-results-title">
        <div class="rpjs-modal-title">
          <h2 id="rpjs-host-results-title">Poll Results</h2>
          <button class="rpjs-modal-close" id="rpjs-results-close" type="button" aria-label="Close poll results">${CLOSE_ICON}</button>
        </div>
        <div class="rpjs-poll-results-question">${this._escapeHtml(results.question)}</div>
        <div class="rpjs-poll-results-summary">${summaryParts.join(' · ')}</div>
        <div class="rpjs-poll-results-list">
          ${results.answers.map((answer, index) => this._renderPollResultRow(answer, index)).join('')}
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
    deactivate = activateModal(overlay, {
      initialFocus: '#rpjs-results-close',
      onRequestClose: close,
    });
    overlay.querySelector('#rpjs-results-close').addEventListener('click', close);
  }

  _renderPollResultRow(answer, index) {
    const count = answer.count || 0;
    const percentage = Math.max(0, Math.min(100, answer.percentage || 0));
    const rank = answer.rank || index + 1;
    const isWinner = Boolean(answer.isWinner);

    return `
      <div class="rpjs-poll-result-row" data-leading="${isWinner ? 'true' : 'false'}">
        <div class="rpjs-poll-result-heading">
          <span class="rpjs-poll-result-rank">#${rank}</span>
          <span class="rpjs-poll-result-text">${this._escapeHtml(answer.text)}</span>
          ${isWinner ? '<span class="rpjs-poll-result-winner">Top choice</span>' : ''}
        </div>
        <div class="rpjs-poll-result-meta">${count} vote${count === 1 ? '' : 's'} · ${percentage}%</div>
        <div class="rpjs-poll-result-bar-bg" role="presentation">
          <div class="rpjs-poll-result-bar-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" style="width:${percentage}%"></div>
        </div>
      </div>
    `;
  }

  _closePollModal() {
    if (this._deactivatePollModal) {
      this._deactivatePollModal();
      this._deactivatePollModal = null;
    }
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
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  show() {
    if (!this.el) this.render();
    this.el.style.display = 'block';
    this.onVisibilityChange?.(true, false);
    requestAnimationFrame(() => {
      if (!this.el || this.el.style.display === 'none') return;
      const active = document.activeElement;
      const canMoveFocus = active === document.body
        || active === document.documentElement
        || active?.id === 'rpjs-btn-hub';
      if (canMoveFocus) this.el.querySelector('.rpjs-hub-menu-item')?.focus();
    });
  }

  hide(restoreFocus = true) {
    if (this.el) this.el.style.display = 'none';
    this.onVisibilityChange?.(false, restoreFocus);
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
    if (this.el && this._keyHandler) {
      this.el.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._outsideClickTimer) {
      clearTimeout(this._outsideClickTimer);
      this._outsideClickTimer = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
