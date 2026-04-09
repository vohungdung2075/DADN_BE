import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
    feed: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
	name: {
		type: String,
		required: true,
		trim: true,
	},
	type: {
		type: String,
		required: true,
		enum : ["sensor", "actuator"],
	},
    unit: {
        type: String,
        default: null,
    },
	isActive: {
		type: Boolean,
		default: false,
	},

	lastActive: {
		type: Date,
		default: null,
	},

	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const Devices = mongoose.model("devices", deviceSchema);
export default Devices;
