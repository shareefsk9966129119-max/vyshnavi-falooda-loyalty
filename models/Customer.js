const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    dob: {
        type: String,
        required: true
    },
    password: {   // 🔐 NEW FIELD
        type: String,
        required: true
    },
    points: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Customer", customerSchema);