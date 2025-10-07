import mongoose from "mongoose";

let UserSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    fname: { type: String },
    lname: { type: String },
    gender: { type: String },
    number: { type: String },
    profilePic: { type: String },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
}, { timestamps: true });

let User = mongoose.model("user", UserSchema);
export default User;
