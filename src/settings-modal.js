/**
 * Settings Modal UI
 */

import { CLOSE_ICON } from './icons.js';
import { saveSettings } from './settings.js';
import { CHARACTER_TYPES, getCharacterConfig, normalizeCharacterType } from './arena-rules.js';

export class SettingsModal {
  constructor(network, settings, onSettingsChange) {
    this.network = network;
    this.settings = { ...settings };
    this.onSettingsChange = onSettingsChange;
    this.el = null;
    this._keyHandler = null;
  }

  render() {
    if (this.el) this.el.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rpjs-modal-overlay';

    const selectedCharacter = normalizeCharacterType(this.settings.arenaCharacter);
    const characterOptions = Object.values(CHARACTER_TYPES).map(character => `
      <option value="${character.id}" ${character.id === selectedCharacter ? 'selected' : ''}>
        ${character.label}
      </option>
    `).join('');
    const character = getCharacterConfig(selectedCharacter);

    overlay.innerHTML = `
      <div class="rpjs-modal">
        <div class="rpjs-modal-title">
          <span>Settings</span>
          <button class="rpjs-modal-close" id="rpjs-settings-close" type="button" aria-label="Close settings">${CLOSE_ICON}</button>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label" for="rpjs-settings-arena-character">Arena Character</label>
          <select class="rpjs-field-input" id="rpjs-settings-arena-character">
            ${characterOptions}
          </select>
          <div id="rpjs-settings-arena-preview" style="margin-top:8px;padding:9px 10px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:12px;line-height:1.45;color:rgba(255,255,255,0.72)">
            ${this._renderCharacterPreview(character)}
          </div>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label">Username</label>
          <input type="text" class="rpjs-field-input" id="rpjs-settings-username"
                 value="${this._escapeAttr(this.settings.username)}" placeholder="Username" maxlength="24">
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label">Custom Color</label>
          <div class="rpjs-color-row">
            <input type="color" class="rpjs-color-picker" id="rpjs-settings-color-picker"
                   value="${this.settings.color}">
            <input type="text" class="rpjs-field-input rpjs-color-hex" id="rpjs-settings-color-hex"
                   value="${this.settings.color}" maxlength="7">
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">Go Offline</span>
            <button class="rpjs-toggle ${this.settings.goOffline ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-offline" type="button" role="switch"
                    aria-label="Go Offline"
                    aria-checked="${this.settings.goOffline}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">Dark Mode</span>
            <button class="rpjs-toggle ${this.settings.darkMode ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-darkmode" type="button" role="switch"
                    aria-label="Dark Mode"
                    aria-checked="${this.settings.darkMode}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">High Contrast / Assisted Visuals</span>
            <button class="rpjs-toggle ${this.settings.highContrast ? 'rpjs-active' : ''}"
                    id="rpjs-toggle-highcontrast" type="button" role="switch"
                    aria-label="High Contrast / Assisted Visuals"
                    aria-checked="${this.settings.highContrast}"></button>
          </div>
        </div>

        <button class="rpjs-save-btn" id="rpjs-settings-save" type="button">Save & Apply</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.el = overlay;
    this._bindEvents();
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

    // Click overlay to close
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    this._keyHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._keyHandler);

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
    this._bindToggle('rpjs-toggle-offline', 'goOffline', (val) => {
      if (val) {
        this.network.goOffline();
      } else {
        this.network.goOnline();
      }
    });

    this._bindToggle('rpjs-toggle-darkmode', 'darkMode', (val) => {
      document.body.classList.toggle('rpjs-dark-mode', val);
    });

    this._bindToggle('rpjs-toggle-highcontrast', 'highContrast', (val) => {
      document.body.classList.toggle('rpjs-high-contrast', val);
    });

    // Save
    this.el.querySelector('#rpjs-settings-save').addEventListener('click', () => {
      this._save();
    });
  }

  _bindToggle(id, key, onChange) {
    const btn = this.el.querySelector(`#${id}`);
    btn.addEventListener('click', () => {
      this.settings[key] = !this.settings[key];
      btn.classList.toggle('rpjs-active', this.settings[key]);
      btn.setAttribute('aria-checked', this.settings[key]);
      if (onChange) onChange(this.settings[key]);
    });
  }

  _save() {
    const username = this.el.querySelector('#rpjs-settings-username').value.trim();
    const color = this.el.querySelector('#rpjs-settings-color-hex').value.trim();
    const arenaCharacter = normalizeCharacterType(
      this.el.querySelector('#rpjs-settings-arena-character').value,
    );

    if (username) this.settings.username = username;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) this.settings.color = color;
    this.settings.arenaCharacter = arenaCharacter;

    saveSettings(this.settings);

    // Update network profile
    this.network.updateProfile(this.settings.username, this.settings.color, this.settings.arenaCharacter);

    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }

    this.close();
  }

  _escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  close() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  destroy() {
    this.close();
  }
}
