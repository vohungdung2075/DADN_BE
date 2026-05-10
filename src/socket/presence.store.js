const membersByHome = new Map();
const homesBySocket = new Map();

const ensureHomeSet = (homeId) => {
	if (!membersByHome.has(homeId)) {
		membersByHome.set(homeId, new Set());
	}
	return membersByHome.get(homeId);
};

const ensureSocketSet = (socketId) => {
	if (!homesBySocket.has(socketId)) {
		homesBySocket.set(socketId, new Set());
	}
	return homesBySocket.get(socketId);
};

const joinHomePresence = (homeId, socketId) => {
	const homeSet = ensureHomeSet(homeId);
	const socketSet = ensureSocketSet(socketId);

	homeSet.add(socketId);
	socketSet.add(homeId);
};

const leaveHomePresence = (homeId, socketId) => {
	const homeSet = membersByHome.get(homeId);
	if (homeSet) {
		homeSet.delete(socketId);
		if (homeSet.size === 0) membersByHome.delete(homeId);
	}

	const socketSet = homesBySocket.get(socketId);
	if (socketSet) {
		socketSet.delete(homeId);
		if (socketSet.size === 0) homesBySocket.delete(socketId);
	}
};

const removeSocketPresence = (socketId) => {
	const socketSet = homesBySocket.get(socketId);
	if (!socketSet) return [];

	const affectedHomeIds = [];

	for (const homeId of socketSet) {
		const homeSet = membersByHome.get(homeId);
		if (!homeSet) continue;
		homeSet.delete(socketId);
		affectedHomeIds.push(homeId);
		if (homeSet.size === 0) membersByHome.delete(homeId);
	}

	homesBySocket.delete(socketId);
	return affectedHomeIds;
};

const getOnlineMemberCountByHome = (homeId) => {
	const homeSet = membersByHome.get(String(homeId));
	if (!homeSet) return 0;
	return homeSet.size;
};

export {
	joinHomePresence,
	leaveHomePresence,
	removeSocketPresence,
	getOnlineMemberCountByHome,
};
