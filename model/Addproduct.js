import mongoose from "mongoose";

let ProductSchema = new mongoose.Schema({
    product_name: { type: String, required: true },
    product_titel: { type: String, required: true },
    product_price: { type: Number, required: true },
    product_oldPrice: { type: Number, required: true },
    product_brand: { type: String, required: true },
    product_type: { type: String, required: true },
    product_warranty: { type: String, required: true },
    product_discount: { type: String, required: true },
    product_des: { type: String, required: true },
    product_img: { type: String, required: true },
    product_return: { type: String },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    product_IsStock: {
        status: { type: String, enum: ["stock", "outofstock"], default: "stock" },
        reason: { type: String },
        updatedAt: { type: Date }
    },

}, { timestamps: true });

let Allproduct = mongoose.model('product', ProductSchema);
export default Allproduct;
