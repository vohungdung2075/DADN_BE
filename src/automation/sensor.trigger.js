/**
 * Nhận raw socket event
 * parse + validate payload, build context chuẩn hóa
 * ruleEngine.evaluate()
 */
class SensorTrigger {
   /**
   * @param {object} socket      - socket.io-client instance (đã connected)
   * @param {object} ruleEngine  - RuleEngine instance có method evaluate(context)
   */
  constructor(socket, ruleEngine)
  {
    if(!socket) throw new Error('SensorTrigger: socket is required');
    if(!ruleEngine) throw new Error('SensorTrigger: RuleEngine is required');

    this._socket = socket;
    this._ruleEngine = ruleEngine;
    this._attached = false;

     
    // Bind để có thể detach đúng handler sau này ?????
    this._handleMqttData       = this._handleMqttData.bind(this);
    this._handleAlertTriggered = this._handleAlertTriggered.bind(this);
  }

  attach() {
    if (this._attached) return;

    this._socket.on('mqtt_data',   this._handleMqttData);
    this._socket.on('alert_triggered', this._handleAlertTriggered);

    this._attached = true;

  }
  detach() {
    if (!this._attached) return;
 
    this._socket.off('mqtt_data',       this._handleMqttData);
    this._socket.off('alert_triggered', this._handleAlertTriggered);
 
    this._attached = false;
    console.log('[SensorTrigger] Detached from socket events.');
  }


  _handleMqttData(payload)
  {
    const parsed = this._parseMqttData(payload);
    if(!parsed) return;
    this._safeEvaluate(parsed);
  } 

  _handleAlertTriggered(payload){
    const parsed = this._parseAlertTriggered(payload);

    if(!parsed) return;

    this._safeEvaluate(parsed);
  }

  _parseMqttData(payload)
  {
    if (!payload || typeof payload !== 'object')
    {
      console.warn('[SensorTrigger] mqtt_data: payload không hợp lệ', payload);
      return null;
    }

    const {homeId, feed, value, time} = payload;

    if(!homeId || !feed)
    {
      console.warn('[SensorTrigger] mqtt_data: thiếu homeId hoặc feed', payload);
    }

    const numericValue = parseFloat(value);
    const parsedvalue = isNaN(numericValue) ? value : numericValue;

    return {
      type: 'mqtt_data',
      homeId,
      feed,
      value: parsedvalue,
      rawValue: value,
      time: time ?? new Date().toISOString(),
    };
  }
  _parseAlertTriggered(payload)
  {
    if (!payload || typeof payload !== 'object')
    {
      console.warn('[SensorTrigger] alert_triggered: payload không hợp lệ', payload);
      return null;
    }
    const {homeId, feed, value, metric, threshold, direction, time} = payload;
    if(!homeId || !feed || !direction)
    {
      console.warn('[SensorTrigger] alert_triggered: thiếu homeId hoặc feed hoặc direction', payload);
      return null;
    }

    return {
      type: 'alert',
      homeId,
      feed,
      value: parseFloat(value) || value,
      rawValue: value,
      metric,
      threshold: parseFloat(threshold),
      direction,
      time: time ?? new Date().toISOString(),
    };
  }
  async _safeEvaluate(context)
  {
    try {
      await this._ruleEngine.evaluate(context); 
    }
    catch(err)
    {
      console.error('[SensorTrigger] RuleEngine error:', err.message, '| context:', context);
    }
  }
}
export default SensorTrigger;