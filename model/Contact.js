import mongoose from "mongoose";

let ContactSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String },
    email: { type: String },
    number: { type: String },
    message: { type: String }
})

let Contact = mongoose.model('contact', ContactSchema)
export default Contact