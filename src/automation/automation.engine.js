import {io }       from 'socket.io-client';
import SensorTrigger from './sensor.trigger.js';

/**
 * AutomationEngine  (v2 — dùng SensorTrigger)
 *
 * Chỉ lo socket lifecycle: connect, reconnect, join/leave rooms.
 * Toàn bộ event parsing + evaluate delegate sang SensorTrigger.
 *
 * Singleton — chỉ có 1 socket connection trong toàn app.
 */
class AutomationEngine {
  constructor() {
    if (AutomationEngine._instance) return AutomationEngine._instance;

    this.socket          = null;
    this._ruleEngine     = null;
    this._trigger        = null;
    this.isRunning       = false;
    this.subscribedHomes = new Set();

    this._reconnectDelay    = 2000;
    this._maxReconnectDelay = 60000;

    AutomationEngine._instance = this;
  }

  static getInstance() {
    if (!AutomationEngine._instance) new AutomationEngine();
    return AutomationEngine._instance;
  }

  async start(ruleEngine, homeIds = []) {
    if (this.isRunning) return;
    this._ruleEngine = ruleEngine;
    this.isRunning   = true;
    homeIds.forEach(id => this.subscribedHomes.add(id));
    this._connect();
    console.log('[AutomationEngine] Started.');
  }

  joinHome(homeId) {
    this.subscribedHomes.add(homeId);
    if (this.socket?.connected) this.socket.emit('join_room', { homeId });
  }

  leaveHome(homeId) {
    this.subscribedHomes.delete(homeId);
    if (this.socket?.connected) this.socket.emit('leave_room', { homeId });
  }

  stop() {
    this.isRunning = false;
    this._trigger?.detach();
    this.socket?.disconnect();
    this.socket   = null;
    this._trigger = null;
    console.log('[AutomationEngine] Stopped.');
  }

  _connect() {
    const localPort = process.env.PORT || 4000;
    const SOCKET_URL = process.env.SOCKET_URL || `http://localhost:${localPort}`;
    const token      = process.env.AUTOMATION_SERVICE_TOKEN;

    this.socket   = io(SOCKET_URL, { auth: { token }, reconnection: false, transports: ['websocket'] });
    this._trigger = new SensorTrigger(this.socket, this._ruleEngine);

    this.socket.on('connect',       () => this._onConnected());
    this.socket.on('disconnect',    r  => this._onDisconnected(r));
    this.socket.on('connect_error', e  => this._onConnectError(e));
    this.socket.on('room_error',    p  => console.error('[AutomationEngine] Room error:', p.message));
  }

  _onConnected() {
    console.log('[AutomationEngine] Connected:', this.socket.id);
    this._reconnectDelay = 2000;
    this._trigger.attach();
    this.subscribedHomes.forEach(homeId => this.socket.emit('join_room', { homeId }));
  }

  _onDisconnected(reason) {
    console.warn('[AutomationEngine] Disconnected:', reason);
    this._trigger?.detach();
    if (!this.isRunning) return;
    if (reason === 'io server disconnect') {
      console.error('[AutomationEngine] Server closed connection. Check token.');
      return;
    }
    this._scheduleReconnect();
  }

  _onConnectError(err) {
    console.error('[AutomationEngine] Connect error:', err.message);
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    const delay = this._reconnectDelay;
    console.log(`[AutomationEngine] Retry in ${delay / 1000}s...`);
    setTimeout(() => { if (this.isRunning) this._connect(); }, delay);
    this._reconnectDelay = Math.min(delay * 2, this._maxReconnectDelay);
  }
}

export default AutomationEngine;