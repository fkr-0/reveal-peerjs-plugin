/**
 * Protocol definitions for PeerJS messaging
 */

export const MSG = {
  // Lobby management
  JOIN: 'join',
  LEAVE: 'leave',
  USER_LIST: 'user-list',
  USERNAME_UPDATE: 'username-update',

  // Chat
  CHAT: 'chat',
  PRIVATE_CHAT: 'private-chat',

  // Hub controls
  JUMP_SLIDE: 'jump-slide',
  FOLLOW_MODE: 'follow-mode',
  SLIDE_CHANGE: 'slide-change',

  // Polls
  POLL_START: 'poll-start',
  POLL_ANSWER: 'poll-answer',
  POLL_RESULTS: 'poll-results',

  // Pong
  PONG_INVITE: 'pong-invite',
  PONG_ACCEPT: 'pong-accept',
  PONG_DECLINE: 'pong-decline',
  PONG_STATE: 'pong-state',
  PONG_MOVE: 'pong-move',
  PONG_SCORE: 'pong-score',
  PONG_END: 'pong-end',

  // Arena (top-down shooter)
  ARENA_START: 'arena-start',
  ARENA_LEAVE: 'arena-leave',
  ARENA_STATE: 'arena-state',
  ARENA_INPUT: 'arena-input',
  ARENA_SHOOT: 'arena-shoot',
  ARENA_HIT: 'arena-hit',
  ARENA_END: 'arena-end',
};

export const PROTOCOL_VERSION = 2;

export const HUB_AUTHORITATIVE_TYPES = new Set([
  MSG.POLL_START,
  MSG.POLL_RESULTS,
  MSG.PONG_INVITE,
  MSG.PONG_ACCEPT,
  MSG.PONG_DECLINE,
  MSG.PONG_MOVE,
  MSG.PONG_STATE,
  MSG.PONG_SCORE,
  MSG.PONG_END,
  MSG.ARENA_START,
  MSG.ARENA_STATE,
  MSG.ARENA_HIT,
  MSG.ARENA_END,
]);

export function createMessage(type, payload) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type,
    payload,
    timestamp: Date.now(),
  };
}
