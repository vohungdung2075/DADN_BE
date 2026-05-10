import HomeMembers from "../src/models/homeMember.model.js";

const checkTenant = async (req, res, next) => {
    try {
        const homeId = req.params.homeId;

        if (!homeId) {
            return res.status(400).json({ message: "Home ID is required" });
        }

        const userId = req.user.id;

        const isMember = await HomeMembers.findOne({ userId: userId, homeId: homeId });

        if (!isMember) {
            return res.status(403).json({ message: "Access denied: You are not a member of this home" });
        }

        req.homeId = homeId; 
        req.tenantRole = isMember.role;

        next();
    } catch (err) {
        console.error('Tenant check error:', err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export default { checkTenant };