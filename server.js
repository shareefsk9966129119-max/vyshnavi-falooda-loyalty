const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// Import Models
const Customer = require("./models/Customer");
const Referral = require("./models/Referral"); // ✅ NEW MODEL

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

// TEST ROUTE
app.get("/all-customers", async (req, res) => {
    const customers = await Customer.find();
    res.json(customers);
});

// ================= CUSTOMER =================

// Add Customer
app.post("/add-customer", async (req, res) => {
    try {
        const { name, phone, dob } = req.body;

        if (!name || !phone || !dob) {
            return res.status(400).json({ message: "Name, Phone and DOB required ❌" });
        }

        const existingCustomer = await Customer.findOne({ phone });

        if (existingCustomer) {
            return res.json({
                message: "Customer already exists ✅",
                customer: existingCustomer
            });
        }

        const newCustomer = new Customer({
            name,
            phone,
            dob,
            points: 0,
            referrals: 0 // ✅ NEW
        });

        await newCustomer.save();

        res.json({
            message: "Customer Added Successfully ✅",
            customer: newCustomer
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
            remaining,
            referrals: customer.referrals || 0 // ✅ NEW
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

// ================= REFERRAL SYSTEM =================

// ✅ ADD REFERRALS API
app.post("/add-referrals", async (req, res) => {
    try {
        const { phone, referrals } = req.body;

        if (!phone || !referrals || referrals.length === 0) {
            return res.json({ message: "No numbers provided ❌" });
        }

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.json({ message: "Customer not found ❌" });
        }

        let addedCount = 0;
        let rejected = [];

        // Remove duplicates in same request
        const uniqueNumbers = [...new Set(referrals)];

        for (let refNumber of uniqueNumbers) {

            // ❌ Self referral
            if (refNumber === phone) {
                rejected.push(refNumber + " (self)");
                continue;
            }

            // ❌ Already used globally
            const exists = await Referral.findOne({ referredPhone: refNumber });

            if (exists) {
                rejected.push(refNumber + " (already used)");
                continue;
            }

            // ✅ Save referral
            await Referral.create({
                referredBy: phone,
                referredPhone: refNumber
            });

            addedCount++;
        }

        // Update count
        customer.referrals += addedCount;

        let rewardMsg = "";

        if (customer.referrals >= 5) {
            customer.points += 1; // 🎁 reward
            customer.referrals = customer.referrals - 5;

            rewardMsg = " 🎉 FREE Scoop Earned!";
        }

        await customer.save();

        res.json({
            message:
                "Added: " + addedCount +
                " | Rejected: " + rejected.length +
                rewardMsg
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});