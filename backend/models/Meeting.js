const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  participants: [{
    type: String,
    trim: true
  }],
  rawCaptions: [{
    speaker: String,
    text: String,
    timestamp: Date
  }],
  summary: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }]
});

const Meeting = mongoose.model('Meeting', MeetingSchema);

module.exports = Meeting; 