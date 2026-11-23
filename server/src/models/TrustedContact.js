const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true },
  relation: { type: String, trim: true, maxlength: 40 },
});

contactSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('TrustedContact', contactSchema);
