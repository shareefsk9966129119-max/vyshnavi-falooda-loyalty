const mongoose = require("mongoose");

// 🟡 REWARD SUB-SCHEMA
const rewardSchema = new mongoose.Schema({
    earnedAt: {
        type: Date,
        default: Date.now
    },
    used: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date,
        default: null
    }
});

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
    password: {
        type: String,
        required: true
    },

    // 🟢 TOTAL PURCHASE COUNT
    points: {
        type: Number,
        default: 0
    },

    // 🎁 REWARD HISTORY (WITH EXPIRY SUPPORT)
    rewards: {
        type: [rewardSchema],
        default: []
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Customer", customerSchema);