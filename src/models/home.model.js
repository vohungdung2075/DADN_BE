import mongoose from "mongoose";

const homeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        default: null,
    },
    aioUsername: {
        type: String,
        default: null, 
    },
    aioKey: {
        type: String,
        default: null,
    },
    aioFeedIds: {
        type: [String],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Homes = mongoose.model("homes", homeSchema);
export default Homes;