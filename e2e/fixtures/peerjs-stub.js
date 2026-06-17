export default class PeerStub {
  constructor(id = undefined) {
    this.id = id || `stub-${Math.random().toString(36).slice(2)}`;
    this.destroyed = false;
    this.disconnected = false;
    this._handlers = new Map();
  }

  on(event, callback) {
    this._handlers.set(event, callback);
  }

  connect(peerId) {
    return {
      peer: peerId,
      open: true,
      sent: [],
      on() {},
      send(message) { this.sent.push(message); },
    };
  }

  destroy() {
    this.destroyed = true;
  }

  disconnect() {
    this.disconnected = true;
  }

  reconnect() {
    this.disconnected = false;
  }
}
