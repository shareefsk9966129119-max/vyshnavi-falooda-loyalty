const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const axios = require("axios");

const app = express();

// 🔐 TEMP OTP STORAGE
const otpStore = {};

// 🟢 STORE STATUS
let storeStatus = "open";
// 🍽 MENU VISIBILITY
let menuVisible = true;

// 🧠 MANUAL OVERRIDE
let manualOverride = false;

// ⏰ STORE TIMING
let openTime = "12:00";
let closeTime = "23:00";

// Import Models
const Customer = require("./models/Customer");
const Order = require("./models/Order");

// Middleware
app.use(cors());
app.use(express.json());

/* ✅ IMPORTANT FIX (MATCH YOUR FOLDER NAME) */
app.use(express.static(path.join(__dirname, "Public")));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error:", err));

/* ✅ DEFAULT ROUTE FIX */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
});


// ================= STORE STATUS =================

function checkStoreTiming() {

    if (manualOverride) return;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0,5);

    if (currentTime >= openTime && currentTime < closeTime) {
        storeStatus = "open";
    } else {
        storeStatus = "closed";
    }
}

setInterval(checkStoreTiming, 60000);

// GET STATUS
app.get("/store-status", (req, res) => {
    checkStoreTiming();

    res.json({
        status: storeStatus,
        openTime,
        closeTime
    });
});

// UPDATE STATUS
app.post("/store-status", (req, res) => {
    const { status } = req.body;

    if (status !== "open" && status !== "closed") {
        return res.status(400).json({ message: "Invalid status ❌" });
    }

    storeStatus = status;
    manualOverride = true;

    res.json({
        message: `Store is now ${status.toUpperCase()} ✅`,
        status
    });
});

// AUTO MODE
app.post("/auto-mode", (req, res) => {
    manualOverride = false;

    res.json({
        message: "Auto mode enabled ⏰"
    });
});

// SAVE TIMING
app.post("/store-timing", (req, res) => {
    const { openTime: o, closeTime: c } = req.body;

    if (!o || !c) {
        return res.status(400).json({ message: "Time required ❌" });
    }

    openTime = o;
    closeTime = c;

    res.json({
        message: "Store timing updated ✅",
        openTime,
        closeTime
    });
});

// ================= MENU CONTROL =================

// GET MENU STATUS
app.get("/menu-status", (req, res) => {
    res.json({
        menuVisible
    });
});

// TOGGLE MENU (ADMIN)
app.post("/toggle-menu", (req, res) => {
    menuVisible = !menuVisible;

    res.json({
        message: menuVisible ? "Menu is now VISIBLE ✅" : "Menu is now HIDDEN ❌",
        menuVisible
    });
});


// ================= CUSTOMER =================

// ADD CUSTOMER
app.post("/add-customer", async (req, res) => {
    try {
        const { name, phone, dob, password } = req.body;

        if (!name || !phone || !dob || !password) {
            return res.status(400).json({ message: "All fields required ❌" });
        }

        const existingCustomer = await Customer.findOne({ phone });

        if (existingCustomer) {
            return res.json({ message: "Customer already exists ✅" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newCustomer = new Customer({
            name,
            phone,
            dob,
            password: hashedPassword,
            points: 0,
            rewards: []
        });

        await newCustomer.save();

        res.json({ message: "Registered Successfully ✅" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LOGIN
app.post("/login-customer", async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ message: "Enter all details ❌" });
        }

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.json({ success: false, message: "User not found ❌" });
        }

        const isMatch = await bcrypt.compare(password, customer.password);

        if (!isMatch) {
            return res.json({ success: false, message: "Wrong password ❌" });
        }

        res.json({ success: true, message: "Login successful ✅" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEND OTP
app.post("/send-otp", async (req, res) => {
    try {
        const { phone } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.json({ message: "User not found ❌" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        otpStore[phone] = {
            otp,
            expires: Date.now() + 5 * 60 * 1000
        };

        console.log("Backup OTP:", otp);

        await axios.post("https://www.fast2sms.com/dev/bulkV2", {
            route: "q",
            message: `Your Vyshnavi Falooda OTP is ${otp}`,
            language: "english",
            flash: 0,
            numbers: phone
        }, {
            headers: {
                authorization: "YOUR_API_KEY",
                "Content-Type": "application/json"
            }
        });

        res.json({ message: "OTP sent 📱" });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ message: "OTP failed ❌" });
    }
});

// RESET PASSWORD
app.post("/reset-password", async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;

        const stored = otpStore[phone];

        if (!stored || stored.otp !== otp) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Customer.findOneAndUpdate(
            { phone },
            { password: hashedPassword }
        );

        delete otpStore[phone];

        res.json({ success: true, message: "Password reset successful ✅" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ================= REWARD SYSTEM =================

app.post("/get-customer", async (req, res) => {
    try {
        const { phone } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found ❌" });
        }

        const rewards = customer.rewards;

        const validRewards = rewards.filter(r => {
    const diff = (Date.now() - new Date(r.earnedAt)) / (1000 * 60 * 60 * 24);
    return diff <= 30 && !r.used;
});

const expiredRewards = rewards.filter(r => {
    const diff = (Date.now() - new Date(r.earnedAt)) / (1000 * 60 * 60 * 24);
    return diff > 30 && !r.used;
});

        res.json({
    name: customer.name,
    phone: customer.phone,
    points: customer.points,
    totalRewards: rewards.length,
    validRewards: validRewards.length,
    expiredRewards: expiredRewards.length,

    rewards: rewards.map(r => {
        const expiryDate = new Date(r.earnedAt);
        expiryDate.setDate(expiryDate.getDate() + 30);

        return {
            earnedAt: r.earnedAt,
            expiryDate,
            used: r.used
        };
    })
});

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD POINTS
app.post("/add-points", async (req, res) => {
    try {
        const { phone, pointsToAdd } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found ❌" });
        }

        customer.points += pointsToAdd;

        const totalRewardsShouldBe = Math.floor(customer.points / 5);
        const currentRewards = customer.rewards.filter(r => !r.used).length;

        if (totalRewardsShouldBe > currentRewards) {
            const newRewards = totalRewardsShouldBe - currentRewards;

            for (let i = 0; i < newRewards; i++) {
                customer.rewards.push({
                    earnedAt: new Date(),
                    used: false
                });
            }
        }

        await customer.save();

        res.json({
            message: "Points & rewards updated ✅",
            points: customer.points,
            rewards: customer.rewards.filter(r => !r.used).length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ✅ ADD HERE (OUTSIDE)
app.post("/redeem-reward", async (req, res) => {

    try {
        const { phone, rewardId } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.json({ message: "Customer not found ❌" });
        }

        const reward = customer.rewards.find(r => r._id.toString() === rewardId);

        if (!reward) {
            return res.json({ message: "Reward not found ❌" });
        }

        if (reward.used) {
            return res.json({ message: "Already redeemed ❌" });
        }

        reward.used = true;

        await customer.save();

        res.json({ message: "Reward given successfully ✅" });

    } catch (error) {
        res.json({ message: "Server error ❌" });
    }
});
 

// ================= ONLINE ORDER SYSTEM =================

// SUBMIT ORDER
app.post("/submit-order", async (req,res)=>{

try{

const { phone, orderId, orderDate, platform } = req.body;

// ❌ DUPLICATE CHECK
const existing = await Order.findOne({ orderId });

if(existing){
return res.json({ message: "Order already submitted ❌" });
}

// SAVE
const order = new Order({
phone,
orderId,
orderDate,
platform
});

await order.save();

res.json({ message: "Order submitted ✅" });

}catch(err){
res.status(500).json({ error: err.message });
}

});

// GET CUSTOMER ORDERS
app.post("/my-orders", async (req,res)=>{

try{

const { phone } = req.body;

const orders = await Order.find({ phone }).sort({ createdAt:-1 });

res.json(orders);

}catch(err){
res.status(500).json({ error: err.message });
}

});

// ADMIN - GET ALL ORDERS
app.get("/all-orders", async (req,res)=>{

try{

const orders = await Order.find().sort({ createdAt:-1 });

res.json(orders);

}catch(err){
res.status(500).json({ error: err.message });
}

});

// APPROVE ORDER
app.post("/approve-order", async (req,res)=>{

try{

const { id } = req.body;

const order = await Order.findById(id);

if(!order) return res.json({ message:"Order not found ❌" });

// 🔥 PREVENT DOUBLE APPROVE
if(order.status !== "approved"){

order.status = "approved";
await order.save();

// 🔥 ADD POINT TO CUSTOMER
const customer = await Customer.findOne({ phone: order.phone });

if(customer){
customer.points += 1;

// 🎁 REWARD LOGIC (VERY IMPORTANT)
const totalRewardsShouldBe = Math.floor(customer.points / 5);
const currentRewards = customer.rewards.filter(r => !r.used).length;

if (totalRewardsShouldBe > currentRewards) {
const newRewards = totalRewardsShouldBe - currentRewards;

for (let i = 0; i < newRewards; i++) {
customer.rewards.push({
earnedAt: new Date(),
used: false
});
}
}

await customer.save();
}

}

res.json({ message:"Approved ✅" });

}catch(err){
res.status(500).json({ error: err.message });
}

});

// REJECT ORDER
app.post("/reject-order", async (req,res)=>{

try{

const { id, message } = req.body;

const order = await Order.findById(id);

if(!order) return res.json({ message:"Order not found ❌" });

order.status = "rejected";
order.message = message || "Kindly check order details";

await order.save();

res.json({ message:"Rejected ❌" });

}catch(err){
res.status(500).json({ error: err.message });
}

});

// ================= SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});


// ================= SELF PING (KEEP SERVER AWAKE) =================

// dynamic import (safe for Node)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

setInterval(() => {
    fetch("https://vyshnavi-falooda-loyalty.onrender.com/")
        .then(() => console.log("🔁 Self ping success"))
        .catch(() => console.log("❌ Self ping failed"));
}, 240000); // every 4 minutes