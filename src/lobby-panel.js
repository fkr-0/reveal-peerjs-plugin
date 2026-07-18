/**
 * Lobby Panel UI - Users list + Chat + Input with private message dropdown
 */

import { CHAT_ICON, CLOSE_ICON, SEND_ICON, CHEVRON_DOWN, LOBBY_ICON, PONG_ICON } from './icons.js';
import { getCharacterConfig } from './arena-rules.js';

export class LobbyPanel {
  constructor(network, settings) {
    this.network = network;
    this.settings = settings;
    this.el = null;
    this.chatTarget = null; // null = lobby, peerId = private
    this._dropdownOpen = false;
    this._contextMenu = null;
    this._onContextMenu = null;
    this._outsideClickHandler = null;
  }

  render() {
    if (this.el) this.el.remove();

    this.el = document.createElement('div');
    this.el.className = 'rpjs-lobby-panel';
    this.el.innerHTML = `
      <div class="rpjs-lobby-header">
        <span>Lobby</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="rpjs-status-dot" id="rpjs-status-dot"></span>
          <button class="rpjs-lobby-close" id="rpjs-lobby-close" type="button" aria-label="Close lobby panel">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="rpjs-resize-handle" id="rpjs-resize-handle" title="Drag to resize"></div>
      <div class="rpjs-users-section" id="rpjs-users-list"></div>
      <div class="rpjs-chat-section" id="rpjs-chat-messages"></div>
      <div class="rpjs-chat-input-area">
        <div class="rpjs-target-dropdown">
          <button class="rpjs-target-btn ${this.chatTarget ? 'rpjs-private-active' : ''}" id="rpjs-target-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
            ${this.chatTarget ? this._getTargetName() : 'Lobby'} ${CHEVRON_DOWN}
          </button>
          <div class="rpjs-target-dropdown-list" id="rpjs-target-dropdown" role="listbox" aria-label="Message target"></div>
        </div>
        <input type="text" class="rpjs-chat-input" id="rpjs-chat-input" placeholder="Type a message..." autocomplete="off" aria-label="Chat message">
        <button class="rpjs-send-btn" id="rpjs-send-btn" type="button" aria-label="Send message">${SEND_ICON}</button>
      </div>
    `;

    document.body.appendChild(this.el);
    this._bindEvents();
    this.updateUsers();
    this.updateChat();
  }

  _getTargetName() {
    if (!this.chatTarget) return 'Lobby';
    const users = this.network.getUserList();
    const u = users.find(u => u.id === this.chatTarget);
    return u ? u.username : 'Lobby';
  }

  _bindEvents() {
    // Close button
    this.el.querySelector('#rpjs-lobby-close').addEventListener('click', () => {
      this.hide();
    });

    // Drag to reposition via header
    const header = this.el.querySelector('.rpjs-lobby-header');
    this._bindDragEvents(header);

    // Resize handle
    const resizeHandle = this.el.querySelector('#rpjs-resize-handle');
    if (resizeHandle) {
      this._bindResizeEvents(resizeHandle);
    }

    // Send on Enter
    const input = this.el.querySelector('#rpjs-chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Send button
    this.el.querySelector('#rpjs-send-btn').addEventListener('click', () => {
      this._sendMessage();
    });

    // Target dropdown toggle
    this.el.querySelector('#rpjs-target-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown();
    });

    // Click outside to close dropdown
    this._outsideClickHandler = () => {
      this._closeDropdown();
    };
    document.addEventListener('click', this._outsideClickHandler);

    // Auto-focus input
    setTimeout(() => input.focus(), 100);
  }

  _bindDragEvents(handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      // Switch from bottom/left positioning to top/left so drag works freely
      this.el.style.bottom = 'auto';
      this.el.style.top = startTop + 'px';
      this.el.style.left = startLeft + 'px';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      let newLeft = startLeft + (e.clientX - startX);
      let newTop = startTop + (e.clientY - startY);
      newLeft = Math.max(0, Math.min(window.innerWidth - 60, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));
      this.el.style.left = newLeft + 'px';
      this.el.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);

    // Touch drag
    let touchId = null;
    handle.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = this.el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      this.el.style.bottom = 'auto';
      this.el.style.top = startTop + 'px';
      this.el.style.left = startLeft + 'px';
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchmove', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== touchId) continue;
        let newLeft = startLeft + (touch.clientX - startX);
        let newTop = startTop + (touch.clientY - startY);
        newLeft = Math.max(0, Math.min(window.innerWidth - 60, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));
        this.el.style.left = newLeft + 'px';
        this.el.style.top = newTop + 'px';
      }
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchend', () => { touchId = null; });
  }

  _bindResizeEvents(handle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const onMouseDown = (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.el.offsetWidth;
      startHeight = this.el.offsetHeight;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newWidth = startWidth + deltaX;
      let newHeight = startHeight - deltaY;

      // Apply constraints
      newWidth = Math.max(280, Math.min(600, newWidth));
      newHeight = Math.max(300, Math.min(window.innerHeight * 0.8, newHeight));

      this.el.style.width = newWidth + 'px';
      this.el.style.height = newHeight + 'px';
    };

    const onMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  _sendMessage() {
    const input = this.el.querySelector('#rpjs-chat-input');
    const text = input.value.trim();
    if (!text) return;

    this.network.sendChat(text, this.chatTarget);
    input.value = '';
    input.focus();
  }

  _toggleDropdown() {
    this._dropdownOpen = !this._dropdownOpen;
    const dropdown = this.el.querySelector('#rpjs-target-dropdown');
    const btn = this.el.querySelector('#rpjs-target-btn');
    if (this._dropdownOpen) {
      this._renderDropdownItems();
      dropdown.classList.add('rpjs-open');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.classList.remove('rpjs-open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  _closeDropdown() {
    this._dropdownOpen = false;
    const dropdown = this.el?.querySelector('#rpjs-target-dropdown');
    if (dropdown) dropdown.classList.remove('rpjs-open');
    const btn = this.el?.querySelector('#rpjs-target-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  _renderDropdownItems() {
    const dropdown = this.el.querySelector('#rpjs-target-dropdown');
    const users = this.network.getUserList();
    const myId = this.network.myId;

    let html = `
      <div class="rpjs-target-dropdown-item" role="option" data-target="">
        <span style="color:rgba(255,255,255,0.5)">${LOBBY_ICON}</span>
        <span>Lobby (Everyone)</span>
      </div>
    `;

    for (const u of users) {
      if (u.id === myId) continue;
      html += `
        <div class="rpjs-target-dropdown-item" role="option" data-target="${u.id}">
          <span class="rpjs-user-dot" style="background:${u.color}"></span>
          <span>${this._escapeHtml(u.username)}${u.isHub ? ' [Hub]' : ''}</span>
        </div>
      `;
    }

    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.rpjs-target-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = item.getAttribute('data-target') || null;
        this.setChatTarget(target);
        this._closeDropdown();
      });
    });
  }

  setChatTarget(peerId) {
    this.chatTarget = peerId;
    const btn = this.el?.querySelector('#rpjs-target-btn');
    if (btn) {
      btn.className = `rpjs-target-btn ${peerId ? 'rpjs-private-active' : ''}`;
      btn.innerHTML = `${peerId ? this._escapeHtml(this._getTargetName()) : 'Lobby'} ${CHEVRON_DOWN}`;
    }
  }

  updateUsers() {
    const listEl = this.el?.querySelector('#rpjs-users-list');
    if (!listEl) return;

    const users = this.network.getUserList();
    const myId = this.network.myId;

    listEl.innerHTML = users.map(u => {
      const character = getCharacterConfig(u.arenaCharacter);
      return `
      <div class="rpjs-user-item" data-peer-id="${u.id}" title="Left-click to set as private message target. Right-click for more options.">
        <span class="rpjs-user-dot" style="background:${u.color}"></span>
        <span class="rpjs-user-name" style="color:${u.color}">${this._escapeHtml(u.username)}</span>
        <span class="rpjs-user-character-tag" title="Arena character: ${character.label}">${character.glyph}</span>
        ${u.isHub ? '<span class="rpjs-user-hub-tag">HUB</span>' : ''}
        ${u.id === myId ? '<span class="rpjs-user-self-tag">YOU</span>' : ''}
      </div>
    `;
    }).join('');

    // Left click on user → set as private message target
    listEl.querySelectorAll('.rpjs-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const peerId = item.getAttribute('data-peer-id');
        if (peerId === myId) return;
        this.setChatTarget(peerId);
      });

      // Right click on user → context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const peerId = item.getAttribute('data-peer-id');
        if (peerId === myId) return;
        this._showContextMenu(e, peerId);
      });
    });
  }

  _showContextMenu(e, peerId) {
    this._hideContextMenu();
    const users = this.network.getUserList();
    const u = users.find(u => u.id === peerId);
    if (!u) return;

    const menu = document.createElement('div');
    menu.className = 'rpjs-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.innerHTML = `
      <div class="rpjs-context-menu-item" data-action="private">
        <span style="color:#ce93d8">${CHAT_ICON}</span>
        <span>Private Message</span>
      </div>
      <div class="rpjs-context-menu-item" data-action="pong">
        <span style="color:#4fc3f7">${PONG_ICON}</span>
        <span>Challenge to Pong</span>
      </div>
    `;

    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Adjust position if menu goes off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    }

    menu.querySelectorAll('.rpjs-context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        if (action === 'private') {
          this.setChatTarget(peerId);
        } else if (action === 'pong') {
          this.network.sendPongInvite(peerId);
          this._addSystemMessage(`Pong challenge sent to ${u.username}!`);
        }
        this._hideContextMenu();
      });
    });

    // Close on click outside
    const closeHandler = (ev) => {
      if (!menu.contains(ev.target)) {
        this._hideContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  _hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  _addSystemMessage(text) {
    const chatEl = this.el?.querySelector('#rpjs-chat-messages');
    if (!chatEl) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'rpjs-chat-msg rpjs-chat-system';
    msgEl.textContent = text;
    chatEl.appendChild(msgEl);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  updateChat() {
    const chatEl = this.el?.querySelector('#rpjs-chat-messages');
    if (!chatEl) return;

    const messages = this.network.chatMessages;
    chatEl.innerHTML = messages.map(m => {
      if (m.private) {
        return `<div class="rpjs-chat-msg rpjs-chat-msg-private">
          <span class="rpjs-chat-private-label">[PM]</span>
          <span class="rpjs-chat-username" style="color:${m.color || '#ce93d8'}">${this._escapeHtml(m.username)}</span>
          <span class="rpjs-chat-text">${this._escapeHtml(m.text)}</span>
        </div>`;
      }
      return `<div class="rpjs-chat-msg">
        <span class="rpjs-chat-username" style="color:${m.color || '#4fc3f7'}">${this._escapeHtml(m.username)}</span>
        <span class="rpjs-chat-text">${this._escapeHtml(m.text)}</span>
      </div>`;
    }).join('');

    chatEl.scrollTop = chatEl.scrollHeight;
  }

  addChatMessage(msg) {
    const chatEl = this.el?.querySelector('#rpjs-chat-messages');
    if (!chatEl) return;

    const msgEl = document.createElement('div');
    msgEl.className = `rpjs-chat-msg ${msg.private ? 'rpjs-chat-msg-private' : ''}`;
    msgEl.innerHTML = `
      ${msg.private ? '<span class="rpjs-chat-private-label">[PM]</span>' : ''}
      <span class="rpjs-chat-username" style="color:${msg.color || '#4fc3f7'}">${this._escapeHtml(msg.username)}</span>
      <span class="rpjs-chat-text">${this._escapeHtml(msg.text)}</span>
    `;
    chatEl.appendChild(msgEl);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  show() {
    if (!this.el) this.render();
    this.el.style.display = 'flex';
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

  isVisible() {
    return this.el && this.el.style.display !== 'none';
  }

  destroy() {
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    this._hideContextMenu();
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
