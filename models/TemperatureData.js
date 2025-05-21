const mongoose = require('mongoose');

const temperatureSchema = new mongoose.Schema({
  temperature: { type: Number, default: 50},
  humidity: { type: Number, default: 50},
  heat_index: { type: Number, default: 50},
  timestamp: { type: Date, default: Date.now }
});

// Check if model already exists, otherwise define it
const TemperatureData = mongoose.models.TemperatureData || mongoose.model('TemperatureData', temperatureSchema);

module.exports = TemperatureData;
