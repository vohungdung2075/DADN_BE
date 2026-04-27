import mongoose from "mongoose";

const deviceLogSchema = new mongoose.Schema({
    homeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'homes',
        required: true,
    },
    feed: {
        type: String,
        required: true,
        trim: true,
    },
    value: {
        type: String,
        required: true,
    },
    createdAt: {
		type: Date,
		default: Date.now,
	},
});

deviceLogSchema.index({ homeId: 1, feed: 1, createdAt: -1 });

const DeviceLogs = mongoose.model("deviceLogs", deviceLogSchema);
export default DeviceLogs;