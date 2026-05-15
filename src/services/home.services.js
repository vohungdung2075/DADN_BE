import HomeMembers from "../models/homeMember.model.js";
import Users from "../models/user.models.js";

const getListHomesByUser = async (userId) => {
	const memberships = await HomeMembers.find({ userId }).populate("homeId");
	return memberships.map((m) => ({
		home: m.homeId,
		role: m.role,
	}));
};

const addMemberToHome = async (homeId, email, role) => {
	const allowedRoles = ["member"];
	if (!allowedRoles.includes(role)) throw new Error("INVALID_ROLE");

	const targetUser = await Users.findOne({ email });
	if (!targetUser) throw new Error("USER_NOT_FOUND");

	const existing = await HomeMembers.findOne({
		userId: targetUser._id,
		homeId: homeId,
	});
	if (existing) throw new Error("MEMBER_ALREADY_EXISTS");

	return await HomeMembers.create({
		userId: targetUser._id,
		homeId: homeId,
		role: role,
	});
};

const getMembersByHome = async (homeId) => {
	const memberships = await HomeMembers.find({ homeId }).populate(
		"userId",
		"username email role",
	);

	return memberships
		.filter((membership) => membership.userId !== null)
		.map((membership) => ({
			userId: membership.userId?._id,
			username: membership.userId?.username,
			email: membership.userId?.email,
			systemRole: membership.userId?.role,
			tenantRole: membership.role,
			addedAt: membership.addedAt,
		}));
};

const updateMemberRoleInHome = async (homeId, userId, role) => {
	const allowedRoles = ["member"];
	if (!allowedRoles.includes(role)) throw new Error("INVALID_ROLE");

	const membership = await HomeMembers.findOne({ homeId, userId });
	if (!membership) throw new Error("MEMBER_NOT_FOUND");
	if (membership.role === "owner") throw new Error("CANNOT_UPDATE_OWNER");

	membership.role = role;
	await membership.save();
	return membership;
};

const removeMemberFromHome = async (homeId, userId) => {
	const membership = await HomeMembers.findOne({ homeId, userId });
	if (!membership) throw new Error("MEMBER_NOT_FOUND");
	if (membership.role === "owner") throw new Error("CANNOT_REMOVE_OWNER");

	await HomeMembers.deleteOne({ _id: membership._id });
};

export default {
	getListHomesByUser,
	addMemberToHome,
	getMembersByHome,
	updateMemberRoleInHome,
	removeMemberFromHome,
};
