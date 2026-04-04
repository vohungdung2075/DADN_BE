import mqttClient from "../mqtt/mqttClient.js";
import Devices from "../models/device.model.js";

const sendCommandToDevice = async (feed, command) => {
    const device = await Devices.findOne({ feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");
    
    if (device.type !== "actuator") {
        throw new Error("DEVICE_NOT_ACTUATOR");
    }
    
	const topic = `${process.env.AIO_USERNAME}/feeds/${feed}`;
    
	return new Promise((resolve, reject) => {
		mqttClient.publish(topic, String(command), (err) => {
			if (err) {
				return reject(new Error("MQTT_PUBLISH_FAILED"));
			}
			resolve({ 
                success: true, 
                feed, 
                command: String(command) 
            });
		});
	});
};

export default { sendCommandToDevice };
