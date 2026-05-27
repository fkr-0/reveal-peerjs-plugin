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
  constructor(network, isInitiator = true, opponentPeerId = null, { onStart, onStop } = {}) {
    this.network = network;
    this.isInitiator = isInitiator; // left side
    this.opponentPeerId = opponentPeerId;
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

    this._onPongMove = null;
    this._onPongAccept = null;
    this._onPongDecline = null;
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
      if (payload.from === this.opponentPeerId) {
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
  }

  _updatePlayerNames() {
    const users = this.network.getUserList();
    const opponent = users.find(u => u.id === this.opponentPeerId);
    const myName = this.network.myUser.username;
    const oppName = opponent ? opponent.username : 'Opponent';

    const playersEl = this.el.querySelector('#rpjs-pong-players');
    if (this.isInitiator) {
      playersEl.innerHTML = `<span style="color:${this.network.myUser.color}">${myName} (Left)</span> vs <span style="color:${opponent?.color || '#fff'}">${oppName} (Right)</span>`;
    } else {
      playersEl.innerHTML = `<span style="color:${opponent?.color || '#fff'}">${oppName} (Left)</span> vs <span style="color:${this.network.myUser.color}">${myName} (Right)</span>`;
    }
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
      this.network.sendPongMove(this.opponentPeerId, Math.max(0, Math.min(1, normalizedY)));
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
      this.network.sendPongMove(this.opponentPeerId, Math.max(0, Math.min(1, normalizedY)));
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
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this._onPongMove) {
      this.network.off('pong-move', this._onPongMove);
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
    // Move ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Top/bottom bounce
    if (this.ball.y - this.BALL_R <= 0 || this.ball.y + this.BALL_R >= this.H) {
      this.ball.vy *= -1;
      this.ball.y = Math.max(this.BALL_R, Math.min(this.H - this.BALL_R, this.ball.y));
    }

    // Left paddle collision
    const leftPaddleX = this.PADDLE_MARGIN;
    if (
      this.ball.x - this.BALL_R <= leftPaddleX + this.PADDLE_W &&
      this.ball.x - this.BALL_R >= leftPaddleX &&
      this.ball.y >= this.leftY - this.PADDLE_H / 2 &&
      this.ball.y <= this.leftY + this.PADDLE_H / 2
    ) {
      this._handlePaddleHit(1);
    }

    // Right paddle collision
    const rightPaddleX = this.W - this.PADDLE_MARGIN - this.PADDLE_W;
    if (
      this.ball.x + this.BALL_R >= rightPaddleX &&
      this.ball.x + this.BALL_R <= rightPaddleX + this.PADDLE_W &&
      this.ball.y >= this.rightY - this.PADDLE_H / 2 &&
      this.ball.y <= this.rightY + this.PADDLE_H / 2
    ) {
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
