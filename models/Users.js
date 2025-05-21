const mongoose = require('mongoose');

//Users Schema
const LogInSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("Users", LogInSchema);
