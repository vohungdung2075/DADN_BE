import mqtt from "mqtt";
import Devices from "../models/device.model.js";
import DeviceLogs from "../models/deviceLog.model.js";
import DeviceStates from "../models/deviceState.model.js";
import Homes from "../models/home.model.js";
import HomeSettings from "../models/homeSetting.model.js";

const mqttClientsByHomeId = new Map();
let mqttInitialized = false;
let socketIo = null;

const sanitizeFeedKey = (feed) => String(feed || "").trim();

const parseConfiguredFeedsFromHome = (home) => {
	const dbFeedsRaw = home?.aioFeedIds;
	const dbFeeds = Array.isArray(dbFeedsRaw)
		? dbFeedsRaw.map((feed) => sanitizeFeedKey(feed)).filter(Boolean)
		: [];

	return {
		feeds: Array.from(new Set(dbFeeds)),
		source: "home.aioFeedIds",
	};
};

const inferDeviceType = (feed) => {
	const normalized = String(feed).toLowerCase();
	if (normalized.includes("fan") || normalized.includes("light") ||
		normalized.includes("servo") || normalized.includes("pir") ||
		normalized.includes("remote")) {
		return "actuator";
	}
	return "sensor";
};

const buildDeviceName = (home, feed) => {
	const homeName = String(home?.name || "").trim();
	return homeName ? `${homeName} - ${feed}` : String(feed);
};

const syncDevicesWhenSubscribed = async (home) => {
	const homeId = String(home._id);
	const { feeds, source } = parseConfiguredFeedsFromHome(home);
	if (feeds.length === 0) {
		return {
			source,
			configuredFeedCount: 0,
			insertedCount: 0,
			alreadyPresentCount: 0,
		};
	}

	const now = new Date();

	const results = await Promise.all(
		feeds.map((feed) =>
			Devices.updateOne(
				{ homeId, feed },
				{
					$set: {
						name: buildDeviceName(home, feed),
					},
					$setOnInsert: {
						homeId,
						feed,
						type: inferDeviceType(feed),
						isActive: false,
						lastActive: null,
						createdAt: now,
					},
				},
				{ upsert: true },
			),
		),
	);

	const insertedCount = results.reduce(
		(count, result) => count + (result.upsertedCount || 0),
		0,
	);

	return {
		source,
		configuredFeedCount: feeds.length,
		insertedCount,
		alreadyPresentCount: feeds.length - insertedCount,
	};
};

const setupMqttClientForHome = async (home, io) => {
	const homeId = String(home._id);
	const allowedFeeds = new Set(parseConfiguredFeedsFromHome(home).feeds);

	if (!home?.aioUsername || !home?.aioKey) {
		return null;
	}

	if (mqttClientsByHomeId.has(homeId)) {
		return mqttClientsByHomeId.get(homeId);
	}

	const client = mqtt.connect("mqtt://io.adafruit.com", {
		username: home.aioUsername,
		password: home.aioKey,
	});

	client.on("connect", () => {
		console.log(`MQTT connected for home ${homeId}`);

		client.subscribe(`${home.aioUsername}/feeds/#`, async (err) => {
			if (err) {
				console.error(`MQTT subscribe error for home ${homeId}:`, err);
				return;
			}
			console.log(`MQTT subscribed for home ${homeId}`);

			try {
				const syncSummary = await syncDevicesWhenSubscribed(home);
				if (syncSummary.configuredFeedCount === 0) {
					console.warn(
						`MQTT device sync skipped for home ${homeId}: no feed ids in ${syncSummary.source}`,
					);
				} else {
					console.log(
						`MQTT device sync for home ${homeId}: source=${syncSummary.source}, configured=${syncSummary.configuredFeedCount}, inserted=${syncSummary.insertedCount}, existed=${syncSummary.alreadyPresentCount}`,
					);
				}
			} catch (syncErr) {
				console.error(
					`MQTT device sync error for home ${homeId}:`,
					syncErr,
				);
			}
		});
	});

	client.on("error", (err) => {
		console.error(`MQTT error for home ${homeId}:`, err);
	});

	client.on("message", async (topic, message) => {
		try {
			const splitTopic = topic.split("/");
			if (splitTopic.length > 3) return;

			const feed = sanitizeFeedKey(splitTopic[2]);
			if (!feed) return;

			if (allowedFeeds.size > 0 && !allowedFeeds.has(feed)) {
				return;
			}

			const value = message.toString();
			const now = new Date();

			let device = await Devices.findOneAndUpdate(
				{ homeId, feed },
				{ lastActive: now, isActive: true },
				{ returnDocument: "after" },
			);

			if (!device) {
				try {
					device = await Devices.create({
						homeId,
						feed,
						name: buildDeviceName(home, feed),
						type: "sensor",
						isActive: true,
						lastActive: now,
					});
					console.log(
						`Auto-created device for home ${homeId}, feed: ${feed}`,
					);
				} catch (createErr) {
					if (createErr?.code === 11000) {
						device = await Devices.findOneAndUpdate(
							{ homeId, feed },
							{ lastActive: now, isActive: true },
							{ returnDocument: "after" },
						);
					} else {
						throw createErr;
					}
				}
			}

			if (!device) return;

			await DeviceLogs.create({
				homeId,
				feed,
				value,
			});

			await DeviceStates.findOneAndUpdate(
				{ homeId, feed },
				{ homeId, feed, value, updatedAt: now },
				{ upsert: true },
			);

			const payload = {
				homeId: String(homeId),
				feed,
				value,
				time: now,
			};

			io.to(`home:${String(homeId)}`).emit("mqtt_data", payload);

			const metricType = (() => {
				const normalized = String(feed).toLowerCase();
				if (normalized.includes("temp")) return "temp";
				if (normalized.includes("humid") || normalized.includes("humi"))
					return "humid";
				return null;
			})();

			const numericValue = parseFloat(value);
			if (metricType && !Number.isNaN(numericValue)) {
				const settings = await HomeSettings.findOne({
					homeId,
				}).lean();
				if (settings) {
					let exceeded = null;

					if (
						metricType === "temp" &&
						typeof settings.tempMax === "number" &&
						numericValue > settings.tempMax
					) {
						exceeded = {
							threshold: settings.tempMax,
							direction: "above_max",
						};
					} else if (
						metricType === "temp" &&
						typeof settings.tempMin === "number" &&
						numericValue < settings.tempMin
					) {
						exceeded = {
							threshold: settings.tempMin,
							direction: "below_min",
						};
					} else if (
						metricType === "humid" &&
						typeof settings.humidMax === "number" &&
						numericValue > settings.humidMax
					) {
						exceeded = {
							threshold: settings.humidMax,
							direction: "above_max",
						};
					} else if (
						metricType === "humid" &&
						typeof settings.humidMin === "number" &&
						numericValue < settings.humidMin
					) {
						exceeded = {
							threshold: settings.humidMin,
							direction: "below_min",
						};
					}

					if (exceeded) {
						io.to(`home:${String(homeId)}`).emit(
							"alert_triggered",
							{
								homeId: String(homeId),
								feed,
								value: numericValue,
								metric: metricType,
								threshold: exceeded.threshold,
								direction: exceeded.direction,
								time: now,
							},
						);
					}
				}
			}
		} catch (err) {
			console.error(`MQTT message error for home ${homeId}:`, err);
		}
	});

	mqttClientsByHomeId.set(homeId, client);
	return client;
};

const registerHomeMqttClient = async (homeOrHomeId) => {
	if (!socketIo) {
		throw new Error("MQTT_NOT_INITIALIZED");
	}

	const home =
		typeof homeOrHomeId === "object"
			? homeOrHomeId
			: await Homes.findById(homeOrHomeId).select(
					"_id name aioUsername aioKey aioFeedIds",
				);

	if (!home) {
		throw new Error("HOME_NOT_FOUND");
	}

	if (!home.aioUsername || !home.aioKey) {
		throw new Error("HOME_MQTT_NOT_CONFIGURED");
	}

	await setupMqttClientForHome(home, socketIo);
	return true;
};

const initMqttClient = async (io) => {
	if (mqttInitialized) return mqttClientsByHomeId;
	mqttInitialized = true;
	socketIo = io;

	const homes = await Homes.find({
		aioUsername: { $nin: [null, ""] },
		aioKey: { $nin: [null, ""] },
	}).select("_id name aioUsername aioKey aioFeedIds");

	for (const home of homes) {
		await setupMqttClientForHome(home, io);
	}

	console.log(`MQTT initialized for ${homes.length} home(s)`);
	return mqttClientsByHomeId;
};

const publishToFeed = (homeId, topic, payload, callback) => {
	const client = mqttClientsByHomeId.get(String(homeId));
	if (!client) {
		return callback(new Error("MQTT_HOME_CLIENT_NOT_FOUND"));
	}

	client.publish(topic, payload, callback);
};

export { initMqttClient, publishToFeed, registerHomeMqttClient };
