import sensorServices from "../services/sensor.services.js";

const handleGetAllFeeds = async (req, res) => {
	try {
		const feeds = await sensorServices.fetchAllFeeds(req.homeId);
		res.status(200).json(feeds);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleGetFeed = async (req, res) => {
	const { feed } = req.params;
	try {
		if (!feed) {
			return res.status(400).json({ message: "Feed is required" });
		}
        
		const sensorFeed = await sensorServices.fetchFeed(req.homeId, feed);
		const result = {
			feed: sensorFeed.feed,
			value: sensorFeed.value,
			updatedAt: sensorFeed.updatedAt,
		};
        
		return res.status(200).json(result);
	} catch (error) {
		if (error.message === "DEVICE_NOT_FOUND" ||
			error.message === "FEED_NOT_FOUND") {
			return res.status(404).json({ error: `Feed "${feed}" not found` });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

const handleGetFeedLogs = async (req, res) => {
	const { feed } = req.params;
	const { limit } = req.query;
	try {        
		if (!feed) {
			return res.status(400).json({ message: "Feed is required" });
		}
        
        let limitNum = parseInt(limit) || 20;
        if (limitNum < 1) limitNum = 1;
        if (limitNum > 100) limitNum = 100;
        
		const logs = await sensorServices.fetchFeedLogs(req.homeId, feed, limitNum);
		res.status(200).json(logs);
	} catch (error) {
		if (error.message === "DEVICE_NOT_FOUND" ||
			error.message === "FEED_NOT_FOUND") {
			return res.status(404).json({ error: `Feed "${feed}" not found` });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

const handleGetMetrics = async (req, res) => {
	try {
		const metrics = await sensorServices.getHomeMetrics(req.homeId);
		res.status(200).json(metrics);
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleGetFeedStats = async (req, res) => {
	const { feed } = req.params;
	const { from, to } = req.query;

	try {
		if (!feed) {
			return res.status(400).json({ message: "Feed is required" });
		}

		const stats = await sensorServices.getFeedStats(req.homeId, feed, from, to);
		res.status(200).json(stats);
	} catch (error) {
		if (error.message === "DEVICE_NOT_FOUND" ||
			error.message === "FEED_NOT_FOUND") {
			return res.status(404).json({ error: `Feed "${feed}" not found` });
		}
		if (error.message === "INVALID_DATE_RANGE") {
			return res.status(400).json({ error: "Invalid date range" });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

const handleUpdateThresholds = async (req, res) => {
	const { tempMax, tempMin, humidMax, humidMin } = req.body;

	const providedFields = [tempMax, tempMin, humidMax, humidMin].filter(
		(value) => value !== undefined,
	);

	if (providedFields.length === 0) {
		return res.status(400).json({ error: "At least one threshold field is required" });
	}

	for (const value of providedFields) {
		if (typeof value !== "number" || Number.isNaN(value)) {
			return res.status(400).json({ error: "Threshold values must be numbers" });
		}
	}

	try {
		const settings = await sensorServices.updateHomeThresholds(req.homeId, {tempMax, tempMin, humidMax, humidMin});

		res.status(200).json({ message: "Update thresholds successfully", settings });
	} catch (error) {
		if (error.message === "INVALID_THRESHOLD_RANGE") {
			return res.status(400).json({ error: "Min threshold must be less than max threshold" });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

export default {
	handleGetAllFeeds,
	handleGetFeed,
	handleGetFeedLogs,
	handleGetMetrics,
	handleGetFeedStats,
	handleUpdateThresholds,
};
