/**
 * Pong mini-game overlay
 * 
 * Two players play pong in a semi-transparent overlay.
 * Left player uses mouse movement, right player receives moves via PeerJS.
 * Ball speed increases on each paddle hit, resets between rounds.
 * First to 10 wins.
 */

import { CLOSE_ICON } from './icons.js';

export class PongGame {
  constructor(network, isInitiator = true, opponentPeerId = null, { onStart, onStop, gameId = null } = {}) {
    this.network = network;
    this.isInitiator = isInitiator; // left side
    this.opponentPeerId = opponentPeerId;
    this.gameId = gameId;
    this._onStartCb = onStart || null;
    this._onStopCb = onStop || null;
    this.el = null;
    this.canvas = null;
    this.ctx = null;
    this.running = false;
    this.animFrame = null;

    // Game state
    this.W = 0;
    this.H = 0;
    this.PADDLE_W = 12;
    this.PADDLE_H = 80;
    this.BALL_R = 8;
    this.PADDLE_MARGIN = 20;

    this.leftY = 0;
    this.rightY = 0;
    this.mouseY = 0;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0 };
    this.scoreLeft = 0;
    this.scoreRight = 0;
    this.baseSpeed = 4;
    this.currentSpeed = 4;
    this.hitCount = 0;
    this._stateFrame = 0;
    this._lastAppliedFrame = -1;
    this._endSent = false;

    this._onPongMove = null;
    this._onPongState = null;
    this._onPongAccept = null;
    this._onPongDecline = null;
    this._onPongEnd = null;
  }

  render() {
    if (this.el) this.el.remove();

    this.el = document.createElement('div');
    this.el.className = 'rpjs-pong-overlay';
    this.el.innerHTML = `
      <canvas class="rpjs-pong-canvas" id="rpjs-pong-canvas"></canvas>
      <div class="rpjs-pong-hud">
        <span class="rpjs-pong-score" id="rpjs-pong-left-score">0</span>
        <span class="rpjs-pong-divider">:</span>
        <span class="rpjs-pong-score" id="rpjs-pong-right-score">0</span>
      </div>
      <div class="rpjs-pong-players" id="rpjs-pong-players"></div>
      <button class="rpjs-pong-exit" id="rpjs-pong-exit">Exit [Esc]</button>
    `;

    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('#rpjs-pong-canvas');
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    this._resetBall();
    this._bindEvents();
    this._updatePlayerNames();

    // Listen for opponent paddle moves
    this._onPongMove = (payload) => {
      if (payload.gameId === this.gameId && payload.from === this.opponentPeerId) {
        // Opponent's y position (0-1 normalized)
        const targetY = payload.y * this.H;
        if (this.isInitiator) {
          this.rightY = targetY;
        } else {
          this.leftY = targetY;
        }
      }
    };
    this.network.on('pong-move', this._onPongMove);

    this._onPongState = (payload) => {
      if (payload.gameId !== this.gameId) return;
      if (payload.from !== this.opponentPeerId) return;
      if (payload.to && payload.to !== this.network.myId) return;
      this._applyState(payload.state);
    };
    this.network.on('pong-state', this._onPongState);

    this._onPongEnd = (payload) => {
      if (payload.gameId !== this.gameId || payload.from !== this.opponentPeerId) return;
      this._endSent = true;
      this.stop();
    };
    this.network.on('pong-end', this._onPongEnd);
  }

  _updatePlayerNames() {
    const users = this.network.getUserList();
    const opponent = users.find(u => u.id === this.opponentPeerId);
    const myName = this.network.myUser.username;
    const oppName = opponent ? opponent.username : 'Opponent';

    const playersEl = this.el.querySelector('#rpjs-pong-players');
    const left = document.createElement('span');
    const right = document.createElement('span');
    const myColor = this.network.myUser.color;
    const opponentColor = opponent?.color || '#fff';

    left.style.color = this.isInitiator ? myColor : opponentColor;
    left.textContent = `${this.isInitiator ? myName : oppName} (Left)`;
    right.style.color = this.isInitiator ? opponentColor : myColor;
    right.textContent = `${this.isInitiator ? oppName : myName} (Right)`;
    playersEl.replaceChildren(left, document.createTextNode(' vs '), right);
  }

  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.leftY = this.H / 2;
    this.rightY = this.H / 2;
  }

  _resetBall() {
    this.ball.x = this.W / 2;
    this.ball.y = this.H / 2;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.currentSpeed = this.baseSpeed;
    this.hitCount = 0;
    this.ball.vx = Math.cos(angle) * this.currentSpeed * dir;
    this.ball.vy = Math.sin(angle) * this.currentSpeed;
  }

  _bindEvents() {
    // Mouse move for paddle control
    this._mouseHandler = (e) => {
      this.mouseY = e.clientY;
      if (this.isInitiator) {
        this.leftY = this.mouseY;
      } else {
        this.rightY = this.mouseY;
      }
      // Send to opponent
      const normalizedY = this.mouseY / this.H;
      this.network.sendPongMove(this.opponentPeerId, Math.max(0, Math.min(1, normalizedY)), this.gameId);
    };
    this.el.addEventListener('mousemove', this._mouseHandler);

    // Touch support
    this._touchHandler = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.mouseY = touch.clientY;
      if (this.isInitiator) {
        this.leftY = this.mouseY;
      } else {
        this.rightY = this.mouseY;
      }
      const normalizedY = this.mouseY / this.H;
      this.network.sendPongMove(this.opponentPeerId, Math.max(0, Math.min(1, normalizedY)), this.gameId);
    };
    this.el.addEventListener('touchstart', this._touchHandler, { passive: false });
    this.el.addEventListener('touchmove', this._touchHandler, { passive: false });

    // Exit
    this.el.querySelector('#rpjs-pong-exit').addEventListener('click', () => {
      this.stop();
    });

    this._keyHandler = (e) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') this.stop();
    };
    document.addEventListener('keydown', this._keyHandler, true);

    // Resize
    this._resizeHandler = () => this._resize();
    window.addEventListener('resize', this._resizeHandler);
  }

  start() {
    this.render();
    this.running = true;
    if (this._onStartCb) this._onStartCb();
    this._loop();
  }

  stop() {
    if (!this._endSent && this.gameId && this.opponentPeerId && this.network.sendPongEnd) {
      this._endSent = true;
      this.network.sendPongEnd(this.opponentPeerId, {
        reason: 'player-left',
        scoreLeft: this.scoreLeft,
        scoreRight: this.scoreRight,
      }, this.gameId);
    }
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this._onPongMove) {
      this.network.off('pong-move', this._onPongMove);
    }
    if (this._onPongState) {
      this.network.off('pong-state', this._onPongState);
    }
    if (this._onPongEnd) {
      this.network.off('pong-end', this._onPongEnd);
    }
    document.removeEventListener('keydown', this._keyHandler, true);
    window.removeEventListener('resize', this._resizeHandler);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    if (this._onStopCb) this._onStopCb();
  }

  _loop() {
    if (!this.running) return;
    this._update();
    this._draw();
    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  _update() {
    // The initiator is the Pong authority. Followers render the latest
    // hub-relayed state snapshot and send only paddle movement commands.
    if (!this.isInitiator) return;

    // Move ball
    const prevX = this.ball.x;
    const prevY = this.ball.y;
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Top/bottom bounce
    if (this.ball.y - this.BALL_R <= 0 || this.ball.y + this.BALL_R >= this.H) {
      this.ball.vy *= -1;
      this.ball.y = Math.max(this.BALL_R, Math.min(this.H - this.BALL_R, this.ball.y));
    }

    // Left paddle collision
    const leftPaddleX = this.PADDLE_MARGIN;
    if (this._ballIntersectsLeftPaddle(prevX, prevY, leftPaddleX)) {
      this.ball.x = leftPaddleX + this.PADDLE_W + this.BALL_R;
      this._handlePaddleHit(1);
    }

    // Right paddle collision
    const rightPaddleX = this.W - this.PADDLE_MARGIN - this.PADDLE_W;
    if (this._ballIntersectsRightPaddle(prevX, prevY, rightPaddleX)) {
      this.ball.x = rightPaddleX - this.BALL_R;
      this._handlePaddleHit(-1);
    }

    // Scoring
    if (this.ball.x < 0) {
      this.scoreRight++;
      this._updateScore();
      if (this.scoreRight >= 10) {
        this._gameOver('right');
      } else {
        this._resetBall();
      }
    }

    if (this.ball.x > this.W) {
      this.scoreLeft++;
      this._updateScore();
      if (this.scoreLeft >= 10) {
        this._gameOver('left');
      } else {
        this._resetBall();
      }
    }

    this._sendState();
  }

  _captureState() {
    return {
      frame: this._stateFrame,
      ball: { ...this.ball },
      leftY: this.leftY,
      rightY: this.rightY,
      scoreLeft: this.scoreLeft,
      scoreRight: this.scoreRight,
      currentSpeed: this.currentSpeed,
      hitCount: this.hitCount,
    };
  }

  _applyState(state) {
    if (!state) return;
    const frame = Number.isFinite(state.frame) ? state.frame : 0;
    if (frame <= this._lastAppliedFrame) return;
    this._lastAppliedFrame = frame;
    if (state.ball) this.ball = { ...state.ball };
    if (typeof state.leftY === 'number') this.leftY = state.leftY;
    if (typeof state.rightY === 'number') this.rightY = state.rightY;
    if (typeof state.scoreLeft === 'number') this.scoreLeft = state.scoreLeft;
    if (typeof state.scoreRight === 'number') this.scoreRight = state.scoreRight;
    if (typeof state.currentSpeed === 'number') this.currentSpeed = state.currentSpeed;
    if (typeof state.hitCount === 'number') this.hitCount = state.hitCount;
    this._updateScore();
  }

  _sendState() {
    if (!this.isInitiator || !this.opponentPeerId || !this.gameId || !this.network.sendPongState) return;
    this._stateFrame++;
    this.network.sendPongState(this.opponentPeerId, this._captureState(), this.gameId);
  }

  _ballOverlapsPaddleY(y, paddleY) {
    return y >= paddleY - this.PADDLE_H / 2 - this.BALL_R &&
      y <= paddleY + this.PADDLE_H / 2 + this.BALL_R;
  }

  _interpolatedBallY(prevX, prevY, targetX) {
    const dx = this.ball.x - prevX;
    if (Math.abs(dx) < 0.0001) return this.ball.y;
    const t = Math.max(0, Math.min(1, (targetX - prevX) / dx));
    return prevY + (this.ball.y - prevY) * t;
  }

  _ballIntersectsLeftPaddle(prevX, prevY, paddleX) {
    const paddleRight = paddleX + this.PADDLE_W;
    const alreadyInside = this.ball.x - this.BALL_R <= paddleRight &&
      this.ball.x - this.BALL_R >= paddleX;
    const sweptThrough = prevX - this.BALL_R >= paddleRight &&
      this.ball.x - this.BALL_R <= paddleRight;
    if (!alreadyInside && !sweptThrough) return false;
    const collisionY = sweptThrough
      ? this._interpolatedBallY(prevX, prevY, paddleRight + this.BALL_R)
      : this.ball.y;
    return this._ballOverlapsPaddleY(collisionY, this.leftY);
  }

  _ballIntersectsRightPaddle(prevX, prevY, paddleX) {
    const paddleRight = paddleX + this.PADDLE_W;
    const alreadyInside = this.ball.x + this.BALL_R >= paddleX &&
      this.ball.x + this.BALL_R <= paddleRight;
    const sweptThrough = prevX + this.BALL_R <= paddleX &&
      this.ball.x + this.BALL_R >= paddleX;
    if (!alreadyInside && !sweptThrough) return false;
    const collisionY = sweptThrough
      ? this._interpolatedBallY(prevX, prevY, paddleX - this.BALL_R)
      : this.ball.y;
    return this._ballOverlapsPaddleY(collisionY, this.rightY);
  }

  _handlePaddleHit(direction) {
    this.hitCount++;
    // Increase speed: +0.3 per hit, reset between rounds
    this.currentSpeed = this.baseSpeed + this.hitCount * 0.3;

    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    this.ball.vx = Math.cos(angle) * this.currentSpeed * direction;
    this.ball.vy = Math.sin(angle) * this.currentSpeed;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Center dashed line
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.W / 2, 0);
    ctx.lineTo(this.W / 2, this.H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left paddle
    ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
    const leftPaddleX = this.PADDLE_MARGIN;
    ctx.beginPath();
    ctx.roundRect(leftPaddleX, this.leftY - this.PADDLE_H / 2, this.PADDLE_W, this.PADDLE_H, 4);
    ctx.fill();

    // Right paddle
    ctx.fillStyle = 'rgba(255, 167, 38, 0.8)';
    const rightPaddleX = this.W - this.PADDLE_MARGIN - this.PADDLE_W;
    ctx.beginPath();
    ctx.roundRect(rightPaddleX, this.rightY - this.PADDLE_H / 2, this.PADDLE_W, this.PADDLE_H, 4);
    ctx.fill();

    // Ball
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Ball glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.BALL_R * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _updateScore() {
    const leftEl = this.el?.querySelector('#rpjs-pong-left-score');
    const rightEl = this.el?.querySelector('#rpjs-pong-right-score');
    if (leftEl) leftEl.textContent = this.scoreLeft;
    if (rightEl) rightEl.textContent = this.scoreRight;
  }

  _gameOver(winner) {
    this.running = false;

    if (this.isInitiator && this.gameId && this.network.sendPongEnd) {
      this._endSent = true;
      this.network.sendPongEnd(this.opponentPeerId, {
        winner,
        scoreLeft: this.scoreLeft,
        scoreRight: this.scoreRight,
      }, this.gameId);
    }

    const isInitiatorWinner = (winner === 'left' && this.isInitiator) || (winner === 'right' && !this.isInitiator);
    const winnerName = isInitiatorWinner ? this.network.myUser.username : 'Opponent';

    // Draw game over text
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${winnerName} Wins!`, this.W / 2, this.H / 2 - 20);
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Click or press any key to close', this.W / 2, this.H / 2 + 30);

    const closeHandler = () => {
      this.stop();
    };

    this.el.addEventListener('click', closeHandler, { once: true });
    document.addEventListener('keydown', closeHandler, { once: true });
  }
}
