import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
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

deviceSchema.index({ homeId: 1, feed: 1 }, { unique: true });

const Devices = mongoose.model("devices", deviceSchema);
export default Devices;
