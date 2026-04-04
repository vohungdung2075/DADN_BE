import Devices from "../models/device.model.js";
import DeviceStates from "../models/deviceState.model.js";
import DeviceLogs from "../models/deviceLog.model.js";

const fetchAllFeeds = async () => {
	const allFeeds = await Devices.find();
    
	const stateFeeds = await DeviceStates.find();
    
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

const fetchFeed = async (feed) => {
	const device = await Devices.findOne({ feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");
    
	const needFeed = await DeviceStates.findOne({ feed: feed });
	if (!needFeed) throw new Error("FEED_NOT_FOUND");
    
	return needFeed;
};

const fetchFeedLogs = async (feed, limit = 20) => {
	const device = await Devices.findOne({ feed: feed });
	if (!device) throw new Error("DEVICE_NOT_FOUND");
    
	const deviceLogs = await DeviceLogs.find({ feed: feed })
		.sort({ createdAt: -1 })
		.limit(limit);
        
	// if (!deviceLogs || deviceLogs.length === 0) throw new Error("DEVICE_LOGS_NOT_FOUND");
    
	return deviceLogs.map((log) => ({
		value: log.value,
		timestamp: log.createdAt,
	}));
};

export default { fetchAllFeeds, fetchFeed, fetchFeedLogs };
