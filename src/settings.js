/**
 * Settings manager with localStorage persistence
 */

const STORAGE_KEY = 'reveal-peerjs-settings';

const DEFAULTS = {
  username: '',
  color: '#4fc3f7',
  darkMode: false,
  highContrast: false,
  goOffline: false,
};

function generateUsername(index) {
  return `slide-visitor#${index}`;
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
}

export { DEFAULTS, STORAGE_KEY };
