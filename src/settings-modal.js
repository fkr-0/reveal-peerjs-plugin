/**
 * Settings Modal UI
 */

import { CLOSE_ICON } from './icons.js';
import { saveSettings } from './settings.js';
import { CHARACTER_TYPES, getCharacterConfig, normalizeCharacterType } from './arena-rules.js';
import { activateModal } from './ui-a11y.js';

export class SettingsModal {
  constructor(network, settings, onSettingsChange, onVisibilityChange = null) {
    this.network = network;
    this.settings = { ...settings };
    this.draft = { ...this.settings };
    this.onSettingsChange = onSettingsChange;
    this.onVisibilityChange = onVisibilityChange;
    this.el = null;
    this._deactivateModal = null;
  }

  render() {
    this.close(false);
    this.draft = { ...this.settings };

    const overlay = document.createElement('div');
    overlay.className = 'rpjs-modal-overlay';

    const selectedCharacter = normalizeCharacterType(this.draft.arenaCharacter);
    const characterOptions = Object.values(CHARACTER_TYPES).map(character => `
      <option value="${character.id}" ${character.id === selectedCharacter ? 'selected' : ''}>
        ${character.label}
      </option>
    `).join('');
    const character = getCharacterConfig(selectedCharacter);

    overlay.innerHTML = `
      <div class="rpjs-modal" role="dialog" aria-modal="true" aria-labelledby="rpjs-settings-title">
        <div class="rpjs-modal-title">
          <h2 id="rpjs-settings-title">Settings</h2>
          <button class="rpjs-modal-close" id="rpjs-settings-close" type="button" aria-label="Close settings">${CLOSE_ICON}</button>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label" for="rpjs-settings-arena-character">Arena Character</label>
          <select class="rpjs-field-input" id="rpjs-settings-arena-character" aria-describedby="rpjs-settings-arena-preview">
            ${characterOptions}
          </select>
          <div class="rpjs-character-preview" id="rpjs-settings-arena-preview">
            ${this._renderCharacterPreview(character)}
          </div>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label" for="rpjs-settings-username">Display name</label>
          <input type="text" class="rpjs-field-input" id="rpjs-settings-username"
                 value="${this._escapeAttr(this.draft.username)}" placeholder="Your name" maxlength="24"
                 autocomplete="nickname" aria-describedby="rpjs-settings-username-help">
          <div class="rpjs-field-help" id="rpjs-settings-username-help">Shown to other people in this presentation.</div>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label" for="rpjs-settings-color-picker">Identity color</label>
          <div class="rpjs-color-row">
            <input type="color" class="rpjs-color-picker" id="rpjs-settings-color-picker"
                   value="${this.draft.color}" aria-label="Choose identity color">
            <input type="text" class="rpjs-field-input rpjs-color-hex" id="rpjs-settings-color-hex"
                   value="${this.draft.color}" maxlength="7" pattern="#[0-9a-fA-F]{6}"
                   aria-label="Identity color hex value" aria-describedby="rpjs-settings-color-help rpjs-settings-error">
          </div>
          <div class="rpjs-field-help" id="rpjs-settings-color-help">Used as a marker; names remain readable at accessible contrast.</div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span>
              <span class="rpjs-toggle-label" id="rpjs-offline-label">Work offline</span>
              <span class="rpjs-toggle-description">Disconnect from the shared lobby.</span>
            </span>
            <button class="rpjs-toggle ${this.draft.goOffline ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-offline" type="button" role="switch"
                    aria-labelledby="rpjs-offline-label"
                    aria-checked="${this.draft.goOffline}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span>
              <span class="rpjs-toggle-label" id="rpjs-darkmode-label">Darken presentation</span>
              <span class="rpjs-toggle-description">Apply dark colors to slide content.</span>
            </span>
            <button class="rpjs-toggle ${this.draft.darkMode ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-darkmode" type="button" role="switch"
                    aria-labelledby="rpjs-darkmode-label"
                    aria-checked="${this.draft.darkMode}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span>
              <span class="rpjs-toggle-label" id="rpjs-contrast-label">Enhanced contrast</span>
              <span class="rpjs-toggle-description">Stronger borders, focus, and text separation.</span>
            </span>
            <button class="rpjs-toggle ${this.draft.highContrast ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-highcontrast" type="button" role="switch"
                    aria-labelledby="rpjs-contrast-label"
                    aria-checked="${this.draft.highContrast}"></button>
          </div>
        </div>

        <div class="rpjs-field-error" id="rpjs-settings-error" role="alert" aria-live="polite"></div>
        <button class="rpjs-save-btn" id="rpjs-settings-save" type="button">Save & Apply</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.el = overlay;
    this._bindEvents();
    this._deactivateModal = activateModal(overlay, {
      initialFocus: '#rpjs-settings-arena-character',
      onRequestClose: () => this.close(),
    });
    this.onVisibilityChange?.(true);
  }

  _bindEvents() {
    // Close
    this.el.querySelector('#rpjs-settings-close').addEventListener('click', () => {
      this.close();
    });

    const characterSelect = this.el.querySelector('#rpjs-settings-arena-character');
    characterSelect.addEventListener('change', () => {
      const character = getCharacterConfig(characterSelect.value);
      this.el.querySelector('#rpjs-settings-arena-preview').innerHTML = this._renderCharacterPreview(character);
    });

    // Color picker ↔ hex sync
    const picker = this.el.querySelector('#rpjs-settings-color-picker');
    const hex = this.el.querySelector('#rpjs-settings-color-hex');

    picker.addEventListener('input', () => {
      hex.value = picker.value;
    });

    hex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
        picker.value = hex.value;
      }
    });

    // Toggle buttons
    this._bindToggle('rpjs-toggle-offline', 'goOffline');
    this._bindToggle('rpjs-toggle-darkmode', 'darkMode');
    this._bindToggle('rpjs-toggle-highcontrast', 'highContrast');

    // Save
    this.el.querySelector('#rpjs-settings-save').addEventListener('click', () => {
      this._save();
    });
  }

  _bindToggle(id, key) {
    const btn = this.el.querySelector(`#${id}`);
    btn.addEventListener('click', () => {
      this.draft[key] = !this.draft[key];
      btn.classList.toggle('rpjs-active', this.draft[key]);
      btn.setAttribute('aria-checked', this.draft[key]);
    });
  }

  _save() {
    const enteredUsername = this.el.querySelector('#rpjs-settings-username').value.trim();
    const username = enteredUsername
      || this.settings.username
      || this.network.myUser?.username
      || 'Guest';
    const color = this.el.querySelector('#rpjs-settings-color-hex').value.trim();
    const arenaCharacter = normalizeCharacterType(
      this.el.querySelector('#rpjs-settings-arena-character').value,
    );
    const error = this.el.querySelector('#rpjs-settings-error');

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      error.textContent = 'Enter a six-digit color such as #4fc3f7.';
      this.el.querySelector('#rpjs-settings-color-hex').focus();
      return;
    }

    error.textContent = '';
    const wasOffline = this.settings.goOffline;
    this.draft.username = username;
    this.draft.color = color;
    this.draft.arenaCharacter = arenaCharacter;
    this.settings = { ...this.draft };

    saveSettings(this.settings);

    if (this.settings.goOffline !== wasOffline) {
      if (this.settings.goOffline) this.network.goOffline();
      else this.network.goOnline();
    }
    document.body.classList.toggle('rpjs-dark-mode', this.settings.darkMode);
    document.body.classList.toggle('rpjs-high-contrast', this.settings.highContrast);

    // Update network profile
    this.network.updateProfile(this.settings.username, this.settings.color, this.settings.arenaCharacter);

    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }

    this.close();
  }

  _escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _renderCharacterPreview(character) {
    const weapon = character.startingWeapon.toUpperCase();
    const armor = character.startArmor ? ` · starts with ${character.startArmor} armor` : '';
    return `<strong style="color:#fff">${character.glyph} · ${character.label}</strong><br>
      ${character.description}<br>
      HP ${character.maxHp} · armor cap ${character.maxArmor}${armor} · ${weapon}`;
  }

  show() {
    this.render();
  }

  close(restoreFocus = true) {
    const wasOpen = Boolean(this.el);
    if (this._deactivateModal) {
      const deactivate = this._deactivateModal;
      this._deactivateModal = null;
      deactivate({ restoreFocus });
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    if (wasOpen) this.onVisibilityChange?.(false);
  }

  destroy() {
    this.close();
  }
}
