const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// Import Customer Model
const Customer = require("./models/Customer");

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, "Public")));

// ✅ MongoDB Connection (FIXED)
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error:", err));

// ✅ Default Route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
});

// ✅ TEST ROUTE
app.get("/all-customers", async (req, res) => {
    try {
        const customers = await Customer.find();
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Add Customer API
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
            points: 0
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

// ✅ Get Customer API
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

// ✅ Add Points API
app.post("/add-points", async (req, res) => {
    try {
        const { phone, pointsToAdd } = req.body;

        if (!phone || pointsToAdd === undefined) {
            return res.status(400).json({ message: "Phone and points required ❌" });
        }

        const customer = await Customer.findOne({ phone });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found ❌" });
        }

        customer.points += pointsToAdd;

        if (customer.points < 0) {
            customer.points = 0;
        }

        // 🎉 Reward Logic
        if (customer.points >= 5) {
            customer.points = 0;
            await customer.save();

            return res.json({
                message: "🎉 FREE Falooda Earned 🥤",
                free: true,
                points: 0
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

// ✅ PORT FIX FOR RENDER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});