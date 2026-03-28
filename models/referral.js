const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
    referredBy: String,
    referredPhone: { type: String, unique: true } // 🔥 prevents duplicates
});

module.exports = mongoose.model("Referral", referralSchema);