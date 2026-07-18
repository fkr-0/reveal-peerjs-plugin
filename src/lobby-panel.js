/**
 * Lobby Panel UI - Users list + Chat + Input with private message dropdown
 */

import { CHAT_ICON, CLOSE_ICON, SEND_ICON, CHEVRON_DOWN, LOBBY_ICON, PONG_ICON } from './icons.js';
import { getCharacterConfig } from './arena-rules.js';

export class LobbyPanel {
  constructor(network, settings, onVisibilityChange = null) {
    this.network = network;
    this.settings = settings;
    this.onVisibilityChange = onVisibilityChange;
    this.el = null;
    this.chatTarget = null; // null = lobby, peerId = private
    this._dropdownOpen = false;
    this._contextMenu = null;
    this._contextMenuKeyHandler = null;
    this._contextMenuOutsideHandler = null;
    this._dropdownKeyHandler = null;
    this._outsideClickHandler = null;
    this._panelKeyHandler = null;
  }

  _escapeAttr(str) {
    return this._escapeHtml(String(str || ''))
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  render() {
    if (this.el) this.el.remove();

    this.el = document.createElement('div');
    this.el.className = 'rpjs-lobby-panel';
    this.el.id = 'rpjs-lobby-panel';
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-labelledby', 'rpjs-lobby-title');
    const connectionLabel = this.settings.goOffline
      ? 'Offline'
      : this.network.myId ? 'Connected' : 'Connecting';
    const connectionClass = this.settings.goOffline
      ? 'rpjs-offline'
      : this.network.myId ? '' : 'rpjs-connecting';
    this.el.innerHTML = `
      <div class="rpjs-lobby-header">
        <div class="rpjs-lobby-heading-group">
          <h2 id="rpjs-lobby-title">Lobby</h2>
          <span class="rpjs-connection-status">
            <span class="rpjs-status-dot ${connectionClass}" id="rpjs-status-dot" aria-hidden="true"></span>
            <span class="rpjs-status-label" id="rpjs-status-label" role="status">${connectionLabel}</span>
          </span>
        </div>
        <div class="rpjs-lobby-header-actions">
          <button class="rpjs-lobby-close" id="rpjs-lobby-close" type="button" aria-label="Close lobby panel">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="rpjs-resize-handle" id="rpjs-resize-handle" title="Drag to resize" aria-hidden="true"></div>
      <div class="rpjs-users-section">
        <div class="rpjs-section-heading">
          <span id="rpjs-users-heading">People</span>
          <span class="rpjs-section-count" id="rpjs-users-count"></span>
        </div>
        <div id="rpjs-users-list" role="list" aria-labelledby="rpjs-users-heading"></div>
      </div>
      <div class="rpjs-chat-section" id="rpjs-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages"></div>
      <form class="rpjs-chat-input-area" id="rpjs-chat-form" aria-label="Send a message">
        <div class="rpjs-target-dropdown">
          <button class="rpjs-target-btn ${this.chatTarget ? 'rpjs-private-active' : ''}" id="rpjs-target-btn" type="button"
                  aria-haspopup="menu" aria-expanded="false" aria-controls="rpjs-target-dropdown">
            ${this.chatTarget ? this._getTargetName() : 'Lobby'} ${CHEVRON_DOWN}
          </button>
          <div class="rpjs-target-dropdown-list" id="rpjs-target-dropdown" role="menu" aria-label="Message target"></div>
        </div>
        <input type="text" class="rpjs-chat-input" id="rpjs-chat-input" placeholder="Type a message..." autocomplete="off" aria-label="Chat message">
        <button class="rpjs-send-btn" id="rpjs-send-btn" type="submit" aria-label="Send message" disabled>${SEND_ICON}</button>
      </form>
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

    // Send through the form so Enter and the button follow the same path.
    const form = this.el.querySelector('#rpjs-chat-form');
    const input = this.el.querySelector('#rpjs-chat-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._sendMessage();
    });
    input.addEventListener('input', () => {
      this._updateSendState();
    });

    // Target dropdown toggle
    this.el.querySelector('#rpjs-target-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown();
    });
    this.el.querySelector('#rpjs-target-btn').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this._openDropdown(e.key === 'ArrowUp' ? 'last' : 'first');
      }
    });
    const dropdown = this.el.querySelector('#rpjs-target-dropdown');
    this._dropdownKeyHandler = (e) => {
      const items = Array.from(dropdown.querySelectorAll('.rpjs-target-dropdown-item'));
      const index = items.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this._closeDropdown(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        items[(index + direction + items.length) % items.length]?.focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        (e.key === 'Home' ? items[0] : items.at(-1))?.focus();
      }
    };
    dropdown.addEventListener('keydown', this._dropdownKeyHandler);
    this._panelKeyHandler = (e) => {
      if (e.key !== 'Escape' || this._dropdownOpen || this._contextMenu) return;
      e.preventDefault();
      this.hide();
    };
    this.el.addEventListener('keydown', this._panelKeyHandler);

    // Click outside to close dropdown
    this._outsideClickHandler = () => {
      this._closeDropdown();
    };
    document.addEventListener('click', this._outsideClickHandler);

  }

  _updateSendState() {
    const input = this.el?.querySelector('#rpjs-chat-input');
    const send = this.el?.querySelector('#rpjs-send-btn');
    if (send) send.disabled = !input?.value.trim();
  }

  _bindDragEvents(handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const onMouseDown = (e) => {
      if (window.matchMedia('(max-width: 600px)').matches) return;
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
      if (window.matchMedia('(max-width: 600px)').matches) return;
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
    this._updateSendState();
    input.focus();
  }

  _toggleDropdown() {
    if (this._dropdownOpen) this._closeDropdown(true);
    else this._openDropdown();
  }

  _openDropdown(focusPosition = null) {
    this._dropdownOpen = true;
    const dropdown = this.el.querySelector('#rpjs-target-dropdown');
    const btn = this.el.querySelector('#rpjs-target-btn');
    this._renderDropdownItems();
    dropdown.classList.add('rpjs-open');
    btn?.setAttribute('aria-expanded', 'true');
    if (focusPosition) {
      const items = Array.from(dropdown.querySelectorAll('.rpjs-target-dropdown-item'));
      const selected = items.find(item => item.getAttribute('aria-checked') === 'true');
      const target = focusPosition === 'last' ? items.at(-1) : selected || items[0];
      target?.focus();
    }
  }

  _closeDropdown(restoreFocus = false) {
    this._dropdownOpen = false;
    const dropdown = this.el?.querySelector('#rpjs-target-dropdown');
    if (dropdown) dropdown.classList.remove('rpjs-open');
    const btn = this.el?.querySelector('#rpjs-target-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) btn?.focus();
  }

  _renderDropdownItems() {
    const dropdown = this.el.querySelector('#rpjs-target-dropdown');
    const users = this.network.getUserList();
    const myId = this.network.myId;

    let html = `
      <button class="rpjs-target-dropdown-item" type="button" role="menuitemradio"
              aria-checked="${this.chatTarget ? 'false' : 'true'}" data-target="">
        <span style="color:rgba(255,255,255,0.5)">${LOBBY_ICON}</span>
        <span>Lobby (Everyone)</span>
      </button>
    `;

    for (const u of users) {
      if (u.id === myId) continue;
      html += `
        <button class="rpjs-target-dropdown-item" type="button" role="menuitemradio"
                aria-checked="${this.chatTarget === u.id ? 'true' : 'false'}" data-target="${this._escapeAttr(u.id)}">
          <span class="rpjs-user-dot" style="background:${u.color}"></span>
          <span>${this._escapeHtml(u.username)}${u.isHub ? ' [Hub]' : ''}</span>
        </button>
      `;
    }

    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.rpjs-target-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = item.getAttribute('data-target') || null;
        this.setChatTarget(target);
        this._closeDropdown(true);
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
    const countEl = this.el?.querySelector('#rpjs-users-count');
    if (countEl) countEl.textContent = String(users.length);

    listEl.innerHTML = users.map(u => {
      const character = getCharacterConfig(u.arenaCharacter);
      const isSelf = u.id === myId;
      return `
      <div class="rpjs-user-row ${isSelf ? 'rpjs-user-row-self' : ''}" role="listitem">
        <button class="rpjs-user-item" type="button" data-peer-id="${this._escapeAttr(u.id)}"
                aria-label="${isSelf ? 'You' : `Message ${this._escapeAttr(u.username)}`}" ${isSelf ? 'disabled' : ''}>
          <span class="rpjs-user-dot" style="background:${u.color}" aria-hidden="true"></span>
          <span class="rpjs-user-name">${this._escapeHtml(u.username)}</span>
          <span class="rpjs-user-character-tag" title="Arena character: ${character.label}" aria-label="${character.label}">${character.glyph}</span>
          ${u.isHub ? '<span class="rpjs-user-hub-tag">HOST</span>' : ''}
          ${isSelf ? '<span class="rpjs-user-self-tag">YOU</span>' : ''}
        </button>
        ${isSelf ? '' : `<button class="rpjs-user-actions" type="button" data-peer-id="${this._escapeAttr(u.id)}" aria-label="More actions for ${this._escapeAttr(u.username)}">•••</button>`}
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

      item.addEventListener('keydown', (e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          this._showContextMenu(item, item.getAttribute('data-peer-id'));
        }
      });
    });

    listEl.querySelectorAll('.rpjs-user-actions').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showContextMenu(button, button.getAttribute('data-peer-id'));
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
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Actions for ${u.username}`);
    const anchor = e instanceof Element
      ? e
      : e.currentTarget instanceof Element ? e.currentTarget : null;
    const anchorRect = anchor?.getBoundingClientRect() || null;
    menu.style.left = `${anchorRect ? anchorRect.right - 8 : e.clientX}px`;
    menu.style.top = `${anchorRect ? anchorRect.bottom + 4 : e.clientY}px`;
    menu.innerHTML = `
      <button class="rpjs-context-menu-item" type="button" role="menuitem" data-action="private">
        <span style="color:#ce93d8">${CHAT_ICON}</span>
        <span>Private Message</span>
      </button>
      <button class="rpjs-context-menu-item" type="button" role="menuitem" data-action="pong">
        <span style="color:#4fc3f7">${PONG_ICON}</span>
        <span>Challenge to Pong</span>
      </button>
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

    const items = Array.from(menu.querySelectorAll('.rpjs-context-menu-item'));
    this._contextMenuKeyHandler = (event) => {
      const index = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        this._hideContextMenu();
        anchor?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + direction + items.length) % items.length]?.focus();
      }
    };
    menu.addEventListener('keydown', this._contextMenuKeyHandler);
    items[0]?.focus();

    // Close on click outside
    this._contextMenuOutsideHandler = (ev) => {
      if (!menu.contains(ev.target)) {
        this._hideContextMenu();
      }
    };
    setTimeout(() => document.addEventListener('click', this._contextMenuOutsideHandler), 0);
  }

  _hideContextMenu() {
    if (this._contextMenuOutsideHandler) {
      document.removeEventListener('click', this._contextMenuOutsideHandler);
      this._contextMenuOutsideHandler = null;
    }
    if (this._contextMenu && this._contextMenuKeyHandler) {
      this._contextMenu.removeEventListener('keydown', this._contextMenuKeyHandler);
      this._contextMenuKeyHandler = null;
    }
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
    chatEl.querySelector('.rpjs-empty-state')?.remove();
    chatEl.appendChild(msgEl);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  updateChat() {
    const chatEl = this.el?.querySelector('#rpjs-chat-messages');
    if (!chatEl) return;

    const messages = this.network.chatMessages;
    if (messages.length === 0) {
      chatEl.innerHTML = '<div class="rpjs-empty-state">No messages yet. Start the conversation.</div>';
      return;
    }

    chatEl.innerHTML = messages.map(m => {
      if (m.private) {
        return `<div class="rpjs-chat-msg rpjs-chat-msg-private">
          <span class="rpjs-chat-private-label">[PM]</span>
          <span class="rpjs-chat-identity-dot" style="background:${m.color || '#ce93d8'}" aria-hidden="true"></span>
          <span class="rpjs-chat-username">${this._escapeHtml(m.username)}</span>
          <span class="rpjs-chat-text">${this._escapeHtml(m.text)}</span>
        </div>`;
      }
      return `<div class="rpjs-chat-msg">
        <span class="rpjs-chat-identity-dot" style="background:${m.color || '#4fc3f7'}" aria-hidden="true"></span>
        <span class="rpjs-chat-username">${this._escapeHtml(m.username)}</span>
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
      <span class="rpjs-chat-identity-dot" style="background:${msg.color || '#4fc3f7'}" aria-hidden="true"></span>
      <span class="rpjs-chat-username">${this._escapeHtml(msg.username)}</span>
      <span class="rpjs-chat-text">${this._escapeHtml(msg.text)}</span>
    `;
    chatEl.querySelector('.rpjs-empty-state')?.remove();
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
    this.onVisibilityChange?.(true);
    requestAnimationFrame(() => {
      if (!this.el || !this.isVisible()) return;
      const active = document.activeElement;
      const canMoveFocus = active === document.body
        || active === document.documentElement
        || active?.id === 'rpjs-btn-lobby';
      if (canMoveFocus) this.el.querySelector('#rpjs-chat-input')?.focus();
    });
  }

  hide() {
    this._closeDropdown();
    this._hideContextMenu();
    if (this.el) this.el.style.display = 'none';
    this.onVisibilityChange?.(false);
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
    const dropdown = this.el?.querySelector('#rpjs-target-dropdown');
    if (dropdown && this._dropdownKeyHandler) {
      dropdown.removeEventListener('keydown', this._dropdownKeyHandler);
      this._dropdownKeyHandler = null;
    }
    if (this.el && this._panelKeyHandler) {
      this.el.removeEventListener('keydown', this._panelKeyHandler);
      this._panelKeyHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
