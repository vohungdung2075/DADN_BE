import sensorServices from "../services/sensor.services.js";

const handleGetAllFeeds = async (req, res) => {
	try {
		const feeds = await sensorServices.fetchAllFeeds();
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
        
		const sensorFeed = await sensorServices.fetchFeed(feed);
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
        
		const logs = await sensorServices.fetchFeedLogs(feed, limitNum);
		res.status(200).json(logs);
	} catch (error) {
		if (error.message === "DEVICE_NOT_FOUND" ||
			error.message === "FEED_NOT_FOUND") {
			return res.status(404).json({ error: `Feed "${feed}" not found` });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

export default { handleGetAllFeeds, handleGetFeed, handleGetFeedLogs };
