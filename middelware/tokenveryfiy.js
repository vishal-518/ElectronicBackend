import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");
        const token = authHeader && authHeader.split(" ")[1]; 
        if (!token) {
            return res.status(401).json({
                status: 401,
                msg: "Access denied, no token provided."
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (err) {
        return res.status(401).json({
            status: 401,
            msg: "Invalid or expired token"
        });
    }
};

export default verifyToken;
