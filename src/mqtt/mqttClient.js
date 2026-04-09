import mqtt from "mqtt";
import Devices from "../models/device.model.js";
import DeviceLogs from "../models/deviceLog.model.js";
import DeviceStates from "../models/deviceState.model.js";

const client = mqtt.connect("mqtt://io.adafruit.com", {
	username: process.env.AIO_USERNAME,
	password: process.env.AIO_KEY,
});

client.on("connect", () => {
	console.log("MQTT connected");

	client.subscribe(`${process.env.AIO_USERNAME}/feeds/#`, (err) => {
		if (err) {
			console.error("MQTT subscribe error:", err);
			return;
		}
		console.log("MQTT subscribed to all feeds");
	});
});

client.on("error", (err) => {
	console.error("MQTT error:", err);
});

client.on("message", async (topic, message) => {
	try {
		const splitTopic = topic.split("/");
		if (splitTopic.length > 3) {
			return;
		}
		const feed = splitTopic[2];
		
		const value = message.toString();
        
		const device = await Devices.findOneAndUpdate(
			{ feed },
			{ lastActive: new Date(), isActive: true }
		);
        
		if (!device) {
			return;
		}
        
		await DeviceLogs.create({
			feed,
			value
		});
        
		await DeviceStates.findOneAndUpdate(
			{ feed },
			{ value, updatedAt: new Date() },
			{ upsert: true } 
		);
	} catch (err) {
		console.error("MQTT message error:", err);
	}
});

export default client;