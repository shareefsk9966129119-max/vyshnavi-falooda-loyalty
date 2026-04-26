const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
phone: String,
orderId: String,
platform: String,
orderDate: String,

status: {
type: String,
default: "pending"
},

message: {
type: String,
default: ""
}

},{ timestamps: true });

module.exports = mongoose.model("Order", orderSchema);