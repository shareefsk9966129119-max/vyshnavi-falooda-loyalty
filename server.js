const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();

// 🔐 TEMP OTP STORAGE
const otpStore = {};

// Import Models
const Customer = require("./models/Customer");

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "Public")));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error:", err));

// Default Route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
});

// ================= CUSTOMER =================

// 🆕 Add Customer
app.post("/add-customer", async (req, res) => {
    try {
        const { name, phone, dob, password } = req.body;

        if (!name || !phone || !dob || !password) {
            return res.status(400).json({ message: "All fields required ❌" });
        }

        const existingCustomer = await Customer.findOne({ phone });

        if (existingCustomer) {
            return res.json({
                message: "Customer already exists ✅"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newCustomer = new Customer({
            name,
            phone,
            dob,
            password: hashedPassword,
            points: 0
        });

        await newCustomer.save();

        res.json({
            message: "Registered Successfully ✅"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔐 LOGIN
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

        res.json({
            success: true,
            message: "Login successful ✅"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔐 SEND OTP
app.post("/send-otp", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ message: "Phone required ❌" });
        }

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.json({ message: "User not found ❌" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        otpStore[phone] = {
            otp,
            expires: Date.now() + 5 * 60 * 1000
        };

        console.log(`OTP for ${phone}: ${otp}`);

        res.json({
            message: "OTP sent (check server console) 🔐"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🔐 RESET PASSWORD (FINAL STEP)
app.post("/reset-password", async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;

        if (!phone || !otp || !newPassword) {
            return res.status(400).json({ message: "All fields required ❌" });
        }

        const stored = otpStore[phone];

        if (!stored) {
            return res.json({ success: false, message: "OTP not found ❌" });
        }

        if (Date.now() > stored.expires) {
            delete otpStore[phone];
            return res.json({ success: false, message: "OTP expired ❌" });
        }

        if (stored.otp !== otp) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Customer.findOneAndUpdate(
            { phone },
            { password: hashedPassword }
        );

        delete otpStore[phone];

        res.json({
            success: true,
            message: "Password reset successful ✅"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Customer
app.post("/get-customer", async (req, res) => {
    try {
        const { phone } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found ❌" });
        }

        const rewardTarget = 5;
        const remaining = rewardTarget - customer.points;

        res.json({
            name: customer.name,
            phone: customer.phone,
            points: customer.points,
            rewardTarget,
            remaining
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Points
app.post("/add-points", async (req, res) => {
    try {
        const { phone, pointsToAdd } = req.body;

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found ❌" });
        }

        customer.points += pointsToAdd;

        if (customer.points >= 5) {
            customer.points = 0;
            await customer.save();

            return res.json({
                message: "🎉 FREE Falooda Earned 🥤",
                free: true
            });
        }

        await customer.save();

        res.json({
            message: "Points Updated ✅",
            free: false,
            points: customer.points
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