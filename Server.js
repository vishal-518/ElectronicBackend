import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import User from './model/User.js'
import bcrypt from 'bcrypt'
import Allproduct from './model/Addproduct.js'
import jwt from 'jsonwebtoken'
import Cart from './model/Addtocart.js'
import verifyToken from './middelware/tokenveryfiy.js'
import Order from './model/Order.js'
import Razorpay from 'razorpay'
import crypto from "crypto";
import nodemailer from "nodemailer";
import Contact from './model/Contact.js'
import { OAuth2Client } from "google-auth-library";
import pincodeDirectory from 'india-pincode-lookup';
import axios from 'axios'
import geolib from 'geolib';
import sgMail from "@sendgrid/mail";
import connectDB from './config/db.js';
import { v4 as uuidv4 } from "uuid";
import cookieParser from "cookie-parser";


dotenv.config()

const app = express()
app.use(express.json())
app.use(cookieParser());


const allowedOrigins = [
  "http://localhost:5173",
  "https://electronicfronted.vercel.app" ,
  "https://electronicbackend-bzcr.onrender.com",
  "https://electronicfronted-6hbh3jdtg-vishals-projects-0b54ee58.vercel.app"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); 
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));


let PORT = process.env.PORT

app.listen(PORT, () => {
    console.log(`server as run ${PORT}`)
})
let tokenBlacklist = []
connectDB()
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


app.post('/signup', async (req, res) => {
    console.log(req.body)
    const { name, email, password, location } = req.body;
    try {
        let alreadyUser = await User.findOne({ email });
        if (alreadyUser) {
            return res.json({ status: 400, msg: 'Email already exists' });
        }
        let otp = crypto.randomInt(100000, 999999)
        let hashpassword = await bcrypt.hash(password, 10);
        let newuser = new User({
            name,
            email,
            password: hashpassword,
            otp,
            location,
            otpExpires: Date.now() + 10 * 60 * 1000
        });


        const msg = {
  to: email,
  from: process.env.FROM_EMAIL, 
  subject: "Your OTP Code",
  text: `Your OTP code is ${otp}`,
  html: `<p>Your OTP code is <strong>${otp}</strong></p>`,
}

await sgMail.send(msg)
await newuser.save();
res.json({
  status: 200,
  msg: 'Signup successful, OTP sent to email'
});


        // const msg = {
        //     to: email,
        //     from: "jakhar365365@gmail.com",
        //     subject: "Your OTP Code",
        //     text: `Your OTP code is ${otp}`,
        //     html: `<p>Your OTP code is <strong>${otp}</strong></p>`,
        // }

        // await sgMail.send(msg)

        // await newuser.save();
        // res.json({
        //     status: 200,
        //     msg: 'Signup successful, OTP sent to email'
        // });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 500, msg: 'Server error' });
    }
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (String(user.otp) !== String(otp)) {
            return res.status(400).json({ msg: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ msg: 'OTP expired' });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        res.status(200).json({ msg: 'successfull' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server error' });
    }
});

app.get('/product/:productId', verifyToken, async (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;

    const product = await Allproduct.findById(productId);
    const user = await User.findById(userId);

    if (!product) return res.json({ status: false, message: "Product not found" });
    if (!user || !user.location) return res.json({ status: false, message: "User location not found" });

    const storeLocation = { latitude: Number(product.location.lat), longitude: Number(product.location.log) }
    const userLocation = { latitude: Number(user.location.lat), longitude: Number(user.location.lng) };

    const distanceMeters = geolib.getDistance(storeLocation, userLocation);
    const distanceKm = distanceMeters / 1000;

    let deliveryCharge = 0;
    if (distanceKm > 5) {
        deliveryCharge = (distanceKm - 5) * 10; // 10₹ per km after 5 km
    }

    res.json({
        status: 200,
        product,
        delivery: {
            distance: distanceKm.toFixed(2),
            deliveryCharge
        }
    });
});

app.post("/update-profile", verifyToken, async (req, res) => {
    try {
        const { fname, lname, gender, number } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { fname, lname, gender, number },
            { new: true }
        ).select("-password");
        if (!updatedUser) return res.status(404).json({ msg: "User not found" });

        res.json({ msg: "Profile updated successfully", updatedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
})


app.post("/auth/google", async (req, res) => {
    const { credential } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { name, email, picture } = payload;

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ name, email, avatar: picture });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.status(200).json({ status: 200, user, ustoken: token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 500, msg: "Google login failed" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body
    let exitsuser = await User.findOne({ email })
    if (!exitsuser) {
        res.json({
            status: 404,
            msg: 'User Not Found'
        })
    }
    if (!exitsuser.isVerified) {
        return res.json({ status: 400, msg: 'Email not verified. Please verify OTP first.' });
    }

    let vaildpassword = await bcrypt.compare(password, exitsuser.password)
    if (!vaildpassword) {
        res.json({
            status: 404,
            msg: 'Invaild Password'
        })
    }

    let token = jwt.sign({ id: exitsuser.id, email: exitsuser.email, role: exitsuser.role }, process.env.JWT_SECRET, { expiresIn: '2h' })

    await res.json({
        status: 200,
        msg: "Login Success",
        usertoken: token,
        exitsuser: {
            id: exitsuser._id,
            name: exitsuser.name,
            email: exitsuser.email,
            role: exitsuser.role
        }
    })
})

app.post("/logout", verifyToken, async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(400).json({ msg: "Token not found" });
    }

    tokenBlacklist.push(token);
    res.json({ msg: "Logged out successfully" });
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ status: 404, msg: 'Email not registered' });
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 5 * 60 * 1000;
    user.otp = otpCode;
    user.otpExpires = otpExpiry;
    await user.save();

    const msg = {
        to: email,
        from: "jakhar365365@gmail.com",
        subject: "Password Reset OTP",
        text: `Your password reset OTP is ${otpCode}`,
        html: `<p>Your password reset OTP is <strong>${otpCode}</strong></p>`,
    };

    await sgMail.send(msg);

    const mailOptions = {
        from: "My App",
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is ${otpCode}. It will expire in 5 minutes.`
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 500, msg: 'Failed to send OTP' });
        }
        res.status(200).json({ status: 200, msg: 'OTP sent to your email' });
    });
});

app.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ status: 404, msg: 'Email not found' });
    }
    if (user.otp !== otp) {
        return res.status(400).json({ status: 400, msg: 'Invalid OTP' });
    }

    if (user.otpExpires < Date.now()) {
        return res.status(400).json({ status: 400, msg: 'OTP has expired' });
    }


    const hashPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashPassword
    user.otp = null
    user.otpExpires = null
    await user.save()

    res.status(200).json({ status: 200, msg: 'Password reset successful' });
})

app.get('/profile', verifyToken, async (req, res) => {
    try {
        let user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        let userObj = user.toObject();
        // Convert filename to full URL if needed
        if (userObj.profilePic && !userObj.profilePic.startsWith('http')) {
            userObj.profilePic = `${req.protocol}://${req.get('host')}/uploads/${userObj.profilePic}`;
        }

        res.json({
            msg: 'success',
            userprofile: userObj
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

app.post('/addproduct', async (req, res) => {
    const { product_name, location, product_price, product_return, product_des, product_img, product_oldPrice, product_brand, product_type, product_warranty, product_discount, product_titel } = req.body
    let product = await Allproduct({
        product_img,
        product_name,
        product_price,
        product_des,
        product_oldPrice,
        product_brand,
        product_type,
        product_warranty,
        product_discount,
        product_titel,
        product_return,
        location
    })

    await product.save()
    res.json({
        status: 200,
        msg: 'Product Added Success  '
    })

})

app.get('/productapi', async (req, res) => {
    try {
        const product = await Allproduct.find({});
        res.json({
            status: 200,
            msg: 'success',
            productdata: product,
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({
            status: 500,
            msg: 'Internal Server Error',
            error: error.message,
        });
    }
});

app.post('/addtocart', verifyToken, async (req, res) => {
    const {
        product_name,
        product_IsStock,
        product_price,
        product_return,
        product_des,
        product_img,
        product_oldPrice,
        product_brand,
        product_type,
        product_warranty,
        product_discount,
        product_titel,
        location,
        delivery,
    } = req.body;

    try {
        let existcart;
        if (req.user) {
            existcart = await Cart.findOne({ user: req.user.id, product_name });
            if (existcart) {
                return res.json({
                    status: 400,
                    msg: "Product already in your cart",
                });
            }

            const cart = new Cart({
                user: req.user.id,
                delivery,
                product_img,
                product_name,
                product_price,
                product_des,
                product_oldPrice,
                product_brand,
                product_type,
                product_warranty,
                product_discount,
                product_titel,
                product_return,
                location,
                product_IsStock,
            });

            await cart.save();
            return res.json({
                status: 200,
                msg: "Product added to your cart ",
            });
        }

        if (req.guestToken) {
            existcart = await Cart.findOne({
                guestToken: req.guestToken,
                product_name,
            });

            if (existcart) {
                return res.json({
                    status: 400,
                    msg: "Product already in cart",
                });
            }

            const cart = new Cart({
                guestToken: req.guestToken,
                delivery,
                product_img,
                product_name,
                product_price,
                product_des,
                product_oldPrice,
                product_brand,
                product_type,
                product_warranty,
                product_discount,
                product_titel,
                product_return,
                location,
                product_IsStock,
            });

            await cart.save();
            return res.json({
                status: 200,
                msg: "Product added to your cart",
            });
        }

        res.json({ status: 400, msg: "Something went wrong" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
});

app.post("/merge-cart", async (req, res) => {
  const { userId, guestToken } = req.body;

  try {
    const guestCart = await Cart.find({ guestToken });
    const userCart = await Cart.find({ user: userId });

    // Merge logic
    for (const item of guestCart) {
      const existingItem = userCart.find(
        (u) => u.productId.toString() === item.productId.toString()
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
        await existingItem.save();
      } else {
        await Cart.create({
          user: userId,
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }

    // Delete guest cart
    await Cart.deleteMany({ guestToken });

    const updatedCart = await Cart.find({ user: userId }).populate("productId");

    res.json({
      status: 200,
      msg: "Guest cart merged successfully",
      cartapidata: updatedCart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, msg: "Cart merge failed" });
  }
});


app.get('/cartapi', verifyToken, async (req, res) => {
    try {
        let cartItems;
        if (req.user) {
            cartItems = await Cart.find({ user: req.user.id });
        } else if (req.guestToken) {
            cartItems = await Cart.find({ guestToken: req.guestToken });
        } else {
            cartItems = [];
        }
        res.json({
            status: 200,
            msg: 'success',
            cartapidata: cartItems
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            msg: 'Internal server error'
        });
    }
});


app.post('/removecart', verifyToken, async (req, res) => {
    let remove = await Cart.findOneAndDelete({ _id: req.body._id })
    if (remove) {
        res.json({
            status: 200,
            msg: 'Cart removed successfully.'
        })
    }
})

app.post('/deleteproduct', async (req, res) => {
    const { id } = req.body
    let deleteata = await Allproduct.findOneAndDelete({ _id: id })
    if (deleteata) {
        res.json({
            status: 200,
            msg: 'Product Delete'
        })
    }
})

app.post('/contact', verifyToken, async (req, res) => {
    console.log(req.body)
    const { name, email, number, message } = req.body
    let contactdata = await Contact({
        user: req.user.id,
        name,
        email,
        number,
        message
    })

    await contactdata.save()
    res.json({
        status: 200,
        msg: 'Success'
    })

})

app.get('/contactapi', async (req, res) => {
    console.log(req.body)
    const contact = await Contact.find({})
    if (!contact) {
        res.json({ status: 500, msg: 'error' })
    }

    res.json({
        status: 200,
        msg: 'success',
        contact
    })
})

app.post("/create-order", async (req, res) => {
    try {
        let { amount, currency } = req.body;

        if (!amount) {
            return res.status(400).json({ msg: "Amount is required" });
        }

        amount = Number(amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ msg: "Invalid amount" });
        }

        const options = {
            amount: Math.round(amount * 100), // ₹ → paise
            currency: currency || "INR",
            receipt: "receipt_order_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        res.json({
            status: 200,
            order_id: order.id,
            order_amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error("Order creation error:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

app.post("/verify-payment", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, msg: "Missing payment details" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (expectedSign === razorpay_signature) {
        res.json({
            success: true,
            msg: "Payment verified successfully",
            data: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
            },
        });
    } else {
        res.status(400).json({ success: false, msg: "Payment verification failed" });
    }
});

app.post('/order', verifyToken, async (req, res) => {
    const { fname, lname, address, town, mobile, email, city, state, pincode, products, totalAmount, paymentMethod } = req.body;
    try {
        let razorpayOrderId = null;
        if (paymentMethod === "online") {
            const options = {
                amount: Math.round(totalAmount * 100),
                currency: "INR",
                receipt: "receipt_order_" + Date.now(),
            };
            const order = await razorpay.orders.create(options);
            razorpayOrderId = order.id;
        }

        let orderDoc = new Order({
            fname,
            lname,
            address,
            town,
            mobile,
            email,
            city,
            state,
            pincode,
            user: req.user.id,
            products,
            totalAmount,
            paymentMethod,
            paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
            razorpay_order_id: razorpayOrderId,
        });

        let savedOrder = await orderDoc.save();

        res.status(201).json({
            status: 201,
            msg: "Order placed successfully",
            data: savedOrder,
            razorpay_order_id: razorpayOrderId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 500, msg: "Something went wrong", error: err.message });
    }
});

app.post('/check-pincode', async (req, res) => {
    const { pincode } = req.body;

    if (!pincode || pincode.length !== 6) {
        return res.status(400).json({ status: 400, success: false, msg: "Invalid Pincode" });
    }

    const result = pincodeDirectory.lookup(pincode);
    if (!result || result.length === 0) {
        return res.json({ status: 404, success: false, msg: "Pincode not serviceable" });
    }
    const location = result[0] || {};

    res.json({
        status: 200,
        success: true,
        msg: `Delivery available in ${location.districtName || 'Unknown'}, ${location.stateName || 'Unknown'}`,
        estimatedDays: 5,
        location: {
            city: location.officeName || 'Unknown',
            district: location.districtName || 'Unknown',
            state: location.stateName || 'Unknown',
        },
    });
});


app.put('/tracking/:id', async (req, res) => {
    try {
        const { status } = req.body; // e.g. "Shipped"
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: "Order not found" });

        order.tracking.status = status;
        order.tracking.updatedAt = new Date();
        await order.save();

        res.json({ msg: "Tracking updated", order });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
})

app.put('/stock/:id', async (req, res) => {
    try {
        const { status } = req.body;
        let product = await Allproduct.findById(req.params.id);

        if (!product) return res.status(404).json({ msg: "Product not found" });

        product.product_IsStock.status = status;
        product.product_IsStock.updatedAt = new Date();
        await product.save();
        res.json({
            msg: "Stock updated successfully",
            product
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
});


app.get('/tracking/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ msg: "Order not found" });
        }
        res.json({
            status: 200,
            tracking: order.tracking
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

app.put('/return/:id', verifyToken, async (req, res) => {
    try {
        const { reason, extraReason, status } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: "Order not found" });


        if (order.user && order.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: "You are not authorized to perform this action" });
        }

        const reasonMap = {
            defective: "Product defective / damaged",
            wrong: "Wrong product delivered",
            missing: "Missing accessories / parts",
            not_as_described: "Product not as described",
            used: "Received used / open box item",
            performance: "Performance issue",
            other: "Other"
        };


        if (status && ["approved", "rejected"].includes(status)) {
            if (!order.return || order.return.status !== "requested") {
                return res.status(400).json({ msg: "No return request found to update status" });
            }
            order.return.status = status;
            order.return.updatedAt = new Date();

            order.return.actionBy = req.user.id;

            await order.save();
            return res.json({ msg: `Return ${status}`, order });
        }

        if (order.return?.status === "requested") {
            return res.status(400).json({ msg: "Return already requested" });
        }

        if (!reason) {
            return res.status(400).json({ msg: "Please provide a return reason" });
        }

        let finalReason = reasonMap[reason] || reason;
        if (reason === "other") {
            if (!extraReason || extraReason.toString().trim().length < 3) {
                return res.status(400).json({ msg: "Please specify a valid reason for 'Other'" });
            }
            finalReason = extraReason.toString().trim();
        }

        if (!order.return) order.return = {};

        order.return.status = "requested";
        order.return.reason = finalReason;
        order.return.requestedAt = new Date();
        order.return.updatedAt = new Date();
        order.return.requestedBy = req.user.id;

        await order.save();

        res.json({ msg: "Return request submitted", order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: error.message });
    }
});

app.post('/order-cencel', verifyToken, async (req, res) => {
    const { id } = req.body
    let order = await Order.findOneAndDelete({ _id: id })
    if (!order) {
        res.json({
            status: 500,
            msg: 'Order Not Found'
        })
    }
    res.json({
        status: 200,
        msg: 'order cancelled'
    })

})

app.get('/orderapi', verifyToken, async (req, res) => {
    const orderdata = await Order.find({ user: req.user.id })
    res.json({
        status: 200,
        msg: "Order history fetched successfully",
        ordata: orderdata
    });
})

app.get('/orderapiadmin', async (req, res) => {
    const orderdata = await Order.find()
    res.json({
        status: 200,
        msg: "Order history fetched successfully",
        ordata: orderdata
    });
})

app.post('/updatepassword', verifyToken, async (req, res) => {
    console.log(req.body)
    const { oldpassword, newpassword } = req.body
    let userdata = await User.findById(req.user.id)
    if (!userdata) {
        res.json({
            status: 404,
            msg: 'user not found'
        })
    }
    let checkpassword = await bcrypt.compare(oldpassword, userdata.password)
    if (!checkpassword) {
        res.json({
            status: 400,
            msg: "Old password does not match"
        });
    }
    let hashpassword = await bcrypt.hash(newpassword, 10)
    userdata.password = hashpassword
    await userdata.save()
    if (userdata) {
        res.json({
            msg: 'success',
            status: 200
        })
    }
})

app.get('/', (req, res) => {
    res.json({
        msg: 'success'
    })
})