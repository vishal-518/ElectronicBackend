import mongoose from "mongoose";

let CartSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guestToken: { type: String, default: null },
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
    product_IsStock: {
        status: { type: String, enum: ["stock", "outofstock"], default: "stock" },
        reason: { type: String },
        updatedAt: { type: Date }
    },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    delivery: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    }
})

let Cart = mongoose.model('cart', CartSchema)
export default Cart