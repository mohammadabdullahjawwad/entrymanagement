var mongoose = require("mongoose");

var visitorSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    checkIn: String,
    id: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Visitor"
        }
    ],
    address: String
});
  
module.exports = mongoose.model("Visitor", visitorSchema);