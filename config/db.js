import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config()

let coneectDB = () => {
    try {
        mongoose.connect(process.env.MONGO_DB_URL)
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }

}

export default coneectDB