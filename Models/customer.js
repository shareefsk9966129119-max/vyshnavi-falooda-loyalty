const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
    name: String,
    phone: String,
    dob: String,   // ✅ NEW
    points: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Customer", customerSchema);