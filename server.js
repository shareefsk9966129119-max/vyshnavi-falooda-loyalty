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

// 🧠 MANUAL OVERRIDE
let manualOverride = false;

// ⏰ STORE TIMING
let openTime = "12:00";
let closeTime = "23:00";

// Import Models
const Customer = require("./models/Customer");

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
            return diff <= 7 && !r.used;
        });

        const expiredRewards = rewards.filter(r => {
            const diff = (Date.now() - new Date(r.earnedAt)) / (1000 * 60 * 60 * 24);
            return diff > 7 && !r.used;
        });

        res.json({
            name: customer.name,
            phone: customer.phone,
            points: customer.points,
            totalRewards: rewards.length,
            validRewards: validRewards.length,
            expiredRewards: expiredRewards.length
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
        const currentRewards = customer.rewards.length;

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
            rewards: customer.rewards.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ================= SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});