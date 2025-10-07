import mongoose from "mongoose";

let orderSchema = mongoose.Schema({
    fname: String,
    lname: String,
    address: String,
    town: String,
    mobile: String,
    email: String,
    city: String,
    state: String,
    pincode: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    products: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: "Addproduct" },
            product_name: String,
            product_titel: String,
            product_price: String,
            product_oldPrice: String,
            product_img: String,
            product_discount: String,
            quantity: String,
            product_return: String,
        },
    ],
    totalAmount: Number,

    // ✅ Payment
    paymentMethod: { type: String, enum: ["cash on delivery", "online"], default: "online" },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    razorpay_order_id: String,
    razorpay_payment_id: String,

    // ✅ Order status
    status: {
        type: String,
        enum: ["Pending", "Shipped", "Out for Delivery", "Delivered", "Cancelled"],
        default: "Pending"
    },

    // ✅ Tracking
    tracking: {
        status: { type: String, default: "Order Placed" },
        updatedAt: { type: Date, default: Date.now }
    },
    // ✅ Return
    return: {
        status: { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
        reason: { type: String },
        updatedAt: { type: Date }
    },   

}, { timestamps: true });

let Order = mongoose.model("Order", orderSchema);
export default Order;
