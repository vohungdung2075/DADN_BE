import express from "express";
import Rule from "../models/rule.model.js";
import { setAutomationLoader } from "../controllers/automation.controllers.js";

const router = express.Router();

// Middleware để get automationLoader
let automationLoader = null;
export const setTestAutomationLoader = (loader) => {
  automationLoader = loader;
};

// ─────────────────────────────────────────────
// TEST ENDPOINTS - chỉ dùng cho development
// ─────────────────────────────────────────────

/**
 * Simulate MQTT data để test automation rules
 * POST /api/test/sensor-data
 */
router.post("/sensor-data", async (req, res) => {
  try {
    const { homeId, feed, value, time } = req.body;

    if (!homeId || !feed || value === undefined) {
      return res.status(400).json({
        error: "Missing required fields: homeId, feed, value"
      });
    }

    // Simulate MQTT payload
    const payload = {
      homeId,
      feed,
      value: String(value),
      time: time || new Date().toISOString()
    };

    // Emit to socket if available (simulate real MQTT)
    // Note: In real scenario, this would come from MQTT client
    const io = req.app.get('io'); // Assuming io is attached to app
    if (io) {
      io.to(`home:${homeId}`).emit('mqtt_data', payload);
    }

    console.log(`[TEST] Simulated MQTT data:`, payload);

    res.json({
      success: true,
      message: "Sensor data simulated",
      payload
    });

  } catch (err) {
    console.error('[TEST] Error simulating sensor data:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Simulate alert trigger để test automation rules
 * POST /api/test/alert-trigger
 */
router.post("/alert-trigger", async (req, res) => {
  try {
    const { homeId, feed, value, metric, threshold, direction, time } = req.body;

    if (!homeId || !feed || !direction || threshold === undefined) {
      return res.status(400).json({
        error: "Missing required fields: homeId, feed, direction, threshold"
      });
    }

    // Simulate alert payload
    const payload = {
      homeId,
      feed,
      value: parseFloat(value) || 0,
      metric: metric || 'value',
      threshold: parseFloat(threshold),
      direction,
      time: time || new Date().toISOString()
    };

    // Emit to socket
    const io = req.app.get('io');
    if (io) {
      io.to(`home:${homeId}`).emit('alert_triggered', payload);
    }

    console.log(`[TEST] Simulated alert:`, payload);

    res.json({
      success: true,
      message: "Alert simulated",
      payload
    });

  } catch (err) {
    console.error('[TEST] Error simulating alert:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Manual trigger time-based rule để test
 * POST /api/test/trigger-rule/:ruleId
 */
router.post("/trigger-rule/:ruleId", async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    if (rule.trigger.type !== 'time') {
      return res.status(400).json({ error: "Only time-based rules can be manually triggered" });
    }

    // Simulate time trigger context
    const context = {
      type: 'time',
      homeId: String(rule.homeId),
      ruleId: String(rule._id)
    };

    // Get RuleEngine from automationLoader
    if (automationLoader && automationLoader._ruleEngine) {
      await automationLoader._ruleEngine.evaluate(context);
    }

    console.log(`[TEST] Manually triggered time rule: ${rule.name}`);

    res.json({
      success: true,
      message: "Rule triggered manually",
      rule: {
        id: rule._id,
        name: rule.name,
        type: rule.trigger.type
      }
    });

  } catch (err) {
    console.error('[TEST] Error triggering rule:', err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get automation logs (recent entries)
 * GET /api/test/logs
 */
router.get("/logs", (req, res) => {
  // In real implementation, you'd store logs in DB or file
  // For now, just return a message
  res.json({
    message: "Check server console for automation logs",
    note: "Logs are printed to console with [Automation] prefix"
  });
});

export default router;