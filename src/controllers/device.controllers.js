import deviceServices from "../services/device.services.js";

const handleSendCommand = async (req, res) => {
    const { feed, command } = req.body;
    try {
        if (!feed || command === undefined) {
            return res.status(400).json({ error: "Feed and command are required" });
        }
        
        if (!["0", "1"].includes(String(command))) {
            return res.status(400).json({ error: 'Command must be "0" or "1"' });
        }
        
        const cmd = await deviceServices.sendCommandToDevice(feed, command);
        res.status(200).json(cmd);
    } catch (error) {
        if (error.message === "DEVICE_NOT_FOUND") {
            return res.status(400).json({ error: `Feed "${feed}" is invalid` });
        }
        
        if (error.message === "DEVICE_NOT_ACTUATOR") {
            return res.status(400).json({ error: `Feed "${feed}" is not an actuator` });
        }
        
        if (error.message === "MQTT_PUBLISH_FAILED") {
            return res.status(502).json({ error: "Failed to publish command to MQTT broker" });
        }
        
        res.status(500).json({ error: "Internal server error" });
    }
};

export default { handleSendCommand };