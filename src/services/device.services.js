import { publishToFeed } from "../mqtt/mqttClient.js";
import Devices from "../models/device.model.js";
import Homes from "../models/home.model.js";

const sendCommandToDevice = async (homeId, feed, command) => {
	const device = await Devices.findOne({ homeId: homeId, feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");

	if (device.type !== "actuator") {
		throw new Error("DEVICE_NOT_ACTUATOR");
	}

	const home = await Homes.findById(homeId).select("aioUsername");
	if (!home || !home.aioUsername) {
		throw new Error("HOME_MQTT_NOT_CONFIGURED");
	}

	const topic = `${home.aioUsername}/feeds/${feed}`;

	const normalizedFeed = String(feed).toLowerCase();
	const isAutoLight = normalizedFeed.includes("auto-light");
	const isAutoFan = normalizedFeed.includes("auto-fan");
	const isRemote = normalizedFeed.includes("remote");
	const isAuto = isAutoLight || isAutoFan || isRemote;
	const isStandardActuator =
		!isAuto &&
		(normalizedFeed.includes("fan") ||
			normalizedFeed.includes("light") ||
			normalizedFeed.includes("servo") ||
			normalizedFeed.includes("pir"));

	const cmdStr = String(command).trim();
	let mappedCommand;

	if (isAuto) {
		if (cmdStr === "2" || cmdStr === "0") {
			mappedCommand = cmdStr;
		} else {
			throw new Error("DEVICE_INVALID_COMMAND");
		}
	} else if (isStandardActuator) {
		if (cmdStr === "1" || cmdStr === "0") {
			mappedCommand = cmdStr;
		} else {
			throw new Error("DEVICE_INVALID_COMMAND");
		}
	} else {
		throw new Error("DEVICE_INVALID_COMMAND");
	}

	return new Promise((resolve, reject) => {
		publishToFeed(homeId, topic, String(mappedCommand), (err) => {
			if (err) {
				if (err.message === "MQTT_HOME_CLIENT_NOT_FOUND") {
					return reject(new Error("MQTT_HOME_CLIENT_NOT_FOUND"));
				}
				return reject(new Error("MQTT_PUBLISH_FAILED"));
			}
			resolve({
				success: true,
				feed,
				command: String(mappedCommand),
			});
		});
	});
};

export default { sendCommandToDevice };
