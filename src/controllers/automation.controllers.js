import Rule from "../models/rule.model.js";
import AutomationLoader from "../automation/automation.loader.js";

// Giả sử loader được khởi tạo global, hoặc pass qua middleware
// Trong thực tế, có thể dùng dependency injection hoặc singleton
let automationLoader = null;

export const setAutomationLoader = (loader) => {
  automationLoader = loader;
};

const handleGetRules = async (req, res) => {
  try {
    const { homeId } = req.params;
    const rules = await Rule.find({ homeId }).lean();
    res.status(200).json(rules);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleCreateRule = async (req, res) => {
  try {
    const { homeId } = req.params;
    const ruleData = { ...req.body, homeId, createdBy: req.user.id };

    const rule = new Rule(ruleData);
    await rule.save();

    // Hot-reload: add to automation
    if (automationLoader) {
      await automationLoader.onRuleCreated(rule);
    }

    res.status(201).json(rule);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleUpdateRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    const rule = await Rule.findByIdAndUpdate(ruleId, updates, { new: true });
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Hot-reload: update in automation
    if (automationLoader) {
      await automationLoader.onRuleUpdated(rule);
    }

    res.status(200).json(rule);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleDeleteRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const rule = await Rule.findByIdAndDelete(ruleId);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Hot-reload: remove from automation
    if (automationLoader) {
      await automationLoader.onRuleDeleted(ruleId, rule.homeId);
    }

    res.status(200).json({ message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export default {
  handleGetRules,
  handleCreateRule,
  handleUpdateRule,
  handleDeleteRule,
  setAutomationLoader
};