import mongoose from "mongoose";
import Devices from "../models/device.model.js";
import DeviceStates from "../models/deviceState.model.js";
import DeviceLogs from "../models/deviceLog.model.js";
import { getOnlineMemberCountByHome } from "../socket/presence.store.js";
import HomeSettings from "../models/homeSetting.model.js";

const getMetricTypeFromFeed = (feed = "") => {
	const normalized = String(feed).toLowerCase();
	if (normalized.includes("temp")) return "temp";
	if (normalized.includes("humid") || normalized.includes("humi")) return "humid";
	return null;
};

const fetchAllFeeds = async (homeId) => {
	const allFeeds = await Devices.find({ homeId: homeId });

	const stateFeeds = await DeviceStates.find({ homeId: homeId });

	const feeds = {};
	let latestTime = null;

	allFeeds.forEach((f) => {
		const state = stateFeeds.find((s) => s.feed === f.feed);

		if (state) {
			feeds[f.feed] = state.value;

			if (!latestTime || state.updatedAt > latestTime) {
				latestTime = state.updatedAt;
			}
		} else {
			feeds[f.feed] = null;
		}
	});
	feeds.updatedAt = latestTime;

	return feeds;
};

const fetchFeed = async (homeId, feed) => {
	const device = await Devices.findOne({ homeId: homeId, feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");

	const needFeed = await DeviceStates.findOne({ homeId: homeId, feed: feed });
	if (!needFeed) throw new Error("FEED_NOT_FOUND");

	return needFeed;
};

const fetchFeedLogs = async (homeId, feed, limit = 20) => {
	const device = await Devices.findOne({ homeId: homeId, feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");

	const deviceLogs = await DeviceLogs.find({ homeId: homeId, feed: feed })
		.sort({ createdAt: -1 })
		.limit(limit);

	// if (!deviceLogs || deviceLogs.length === 0) throw new Error("DEVICE_LOGS_NOT_FOUND");

	return deviceLogs.map((log) => ({
		value: log.value,
		timestamp: log.createdAt,
	}));
};

const getHomeMetrics = async (homeId) => {
	const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const staleThresholdMs = 15 * 60 * 1000;

	const allFeeds = await Devices.find({ homeId: homeId });
	const currentStates = await DeviceStates.find({ homeId: homeId });
	const settings = await HomeSettings.findOne({ homeId: homeId });

	const metrics = {
		currentReadings: {},
		averages24h: {},
		alerts: [],
		onlineMemberCount: getOnlineMemberCountByHome(homeId),
	};

	for (const device of allFeeds) {
		const currentState = currentStates.find(
			(state) => state.feed === device.feed,
		);
		const currentValue = currentState ? currentState.value : null;

		metrics.currentReadings[device.feed] = {
			value: currentValue,
			timestamp: currentState?.updatedAt || null,
		};

		if (!currentState) {
			metrics.alerts.push({
				type: "NO_DATA",
				feed: device.feed,
				message: `No current state found for feed ${device.feed}`,
			});
		} else if (Date.now() - new Date(currentState.updatedAt).getTime() > staleThresholdMs) {
			metrics.alerts.push({
				type: "STALE_DATA",
				feed: device.feed,
				message: `Feed ${device.feed} has no update for more than 15 minutes`,
				lastUpdate: currentState.updatedAt,
			});
		}

		const metricType = getMetricTypeFromFeed(device.feed);
		const numericValue = parseFloat(currentValue);
		if (metricType && settings && !Number.isNaN(numericValue)) {
			if (metricType === "temp" && typeof settings.tempMax === "number" && numericValue > settings.tempMax) {
				metrics.alerts.push({
					type: "THRESHOLD_EXCEEDED",
					metric: "temp",
					feed: device.feed,
					value: numericValue,
					threshold: settings.tempMax,
					direction: "above_max",
				});
			}

			if (metricType === "temp" && typeof settings.tempMin === "number" && numericValue < settings.tempMin) {
				metrics.alerts.push({
					type: "THRESHOLD_EXCEEDED",
					metric: "temp",
					feed: device.feed,
					value: numericValue,
					threshold: settings.tempMin,
					direction: "below_min",
				});
			}

			if (metricType === "humid" && typeof settings.humidMax === "number" && numericValue > settings.humidMax) {
				metrics.alerts.push({
					type: "THRESHOLD_EXCEEDED",
					metric: "humid",
					feed: device.feed,
					value: numericValue,
					threshold: settings.humidMax,
					direction: "above_max",
				});
			}

			if (metricType === "humid" && typeof settings.humidMin === "number" && numericValue < settings.humidMin) {
				metrics.alerts.push({
					type: "THRESHOLD_EXCEEDED",
					metric: "humid",
					feed: device.feed,
					value: numericValue,
					threshold: settings.humidMin,
					direction: "below_min",
				});
			}
		}

		const logsLast24h = await DeviceLogs.find({
			homeId: homeId,
			feed: device.feed,
			createdAt: { $gte: twentyFourHoursAgo },
		});

		if (logsLast24h.length > 0) {
			const values = logsLast24h
				.map((log) => parseFloat(log.value))
				.filter((value) => !isNaN(value));

			if (values.length > 0) {
				const average = values.reduce((sum, value) => sum + value, 0) / values.length;
				metrics.averages24h[device.feed] = parseFloat(
					average.toFixed(2),
				);
			}
		}
	}

	return metrics;
};

const updateHomeThresholds = async (homeId, updates) => {
	const existing = await HomeSettings.findOne({ homeId });

	const nextTempMin = updates.tempMin ?? existing?.tempMin ?? null;
    const nextTempMax = updates.tempMax ?? existing?.tempMax ?? null;
    const nextHumidMin = updates.humidMin ?? existing?.humidMin ?? null;
    const nextHumidMax = updates.humidMax ?? existing?.humidMax ?? null;

	if (nextTempMin !== null && nextTempMax !== null && nextTempMin >= nextTempMax) {
		throw new Error("INVALID_THRESHOLD_RANGE");
	}

	if (nextHumidMin !== null && nextHumidMax !== null && nextHumidMin >= nextHumidMax) {
		throw new Error("INVALID_THRESHOLD_RANGE");
	}

	const settings = await HomeSettings.findOneAndUpdate(
		{ homeId },
		{
			$set: {
				...(updates.tempMax !== undefined && { tempMax: updates.tempMax }),
				...(updates.tempMin !== undefined && { tempMin: updates.tempMin }),
				...(updates.humidMax !== undefined && { humidMax: updates.humidMax }),
				...(updates.humidMin !== undefined && { humidMin: updates.humidMin }),
				updatedAt: new Date(),
			},
		},
		{ returnDocument: "after", upsert: true },
	);

	return settings;
};

const getFeedStats = async (homeId, feed, fromISO, toISO) => {
	const device = await Devices.findOne({ homeId: homeId, feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");

	const now = new Date();
	let fromDate = fromISO
		? new Date(fromISO)
		: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	let toDate = toISO ? new Date(toISO) : now;

	if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
		throw new Error("INVALID_DATE_RANGE");
	}

	if (fromDate > toDate) {
		throw new Error("INVALID_DATE_RANGE");
	}

	const logs = await DeviceLogs.find({
		homeId: homeId,
		feed: feed,
		createdAt: { $gte: fromDate, $lte: toDate },
	}).sort({ createdAt: 1 });

	if (logs.length === 0) {
		return {
			feed: feed,
			from: fromDate.toISOString(),
			to: toDate.toISOString(),
			min: null,
			max: null,
			average: null,
			count: 0,
			data: [],
		};
	}

	const values = logs
		.map((log) => parseFloat(log.value))
		.filter((v) => !isNaN(v));

	const min = Math.min(...values);
	const max = Math.max(...values);
	const average = values.reduce((a, b) => a + b, 0) / values.length;

	return {
		feed: feed,
		from: fromDate.toISOString(),
		to: toDate.toISOString(),
		min: parseFloat(min.toFixed(2)),
		max: parseFloat(max.toFixed(2)),
		average: parseFloat(average.toFixed(2)),
		count: logs.length,
		data: logs.map((log) => ({
			value: parseFloat(log.value),
			timestamp: log.createdAt,
		})),
	};
};

export default {
	fetchAllFeeds,
	fetchFeed,
	fetchFeedLogs,
	getHomeMetrics,
	getFeedStats,
	updateHomeThresholds,
};
