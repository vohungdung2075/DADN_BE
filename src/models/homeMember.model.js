import mongoose from "mongoose";

const homeMemberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
    },
    homeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'homes',
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['owner', 'member', 'guest'], 
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
});

homeMemberSchema.index({ userId: 1, homeId: 1 }, { unique: true });

const HomeMembers = mongoose.model("homeMembers", homeMemberSchema);
export default HomeMembers;