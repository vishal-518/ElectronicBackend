// import jwt from "jsonwebtoken";
// import { v4 as uuidv4 } from "uuid";
// import dotenv from "dotenv";
// dotenv.config();

// const verifyToken = (req, res, next) => {
//     try {
//         const authHeader = req.header("Authorization");
//         const token = authHeader && authHeader.split(" ")[1];
//         const guestToken = req.cookies?.guestToken
//         if (!token) {
//             return res.status(401).json({
//                 status: 401,
//                 msg: "Access denied, no token provided."
//             });
//         }
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = decoded;
//         next();

//         if (!guestToken) {
//             const newGuestToken = uuidv4()
//             res.cookies('guestToken', newGuestToken, {
//                 maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
//                 httpOnly: true,
//                 sameSite: "lax",
//             })
//             req.guestToken = newGuestToken;
//         } else {
//             req.guestToken = guestToken;
//         }
//         next();
//     } catch (err) {
//         return res.status(401).json({
//             status: 401,
//             msg: "Invalid or expired token"
//         });
//     }
// };

// export default verifyToken;

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();


const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];
    const guestToken = req.cookies?.guestToken;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } else {
      if (!guestToken) {
        const newGuestToken = uuidv4();
        res.cookie("guestToken", newGuestToken, {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          httpOnly: true,
          sameSite: "lax",
        });
        req.guestToken = newGuestToken;
      } else {
        req.guestToken = guestToken;
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      status: 401,
      msg: "Invalid or expired token",
    });
  }
};

export default verifyToken;
