const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');

// @route   POST api/meetings
// @desc    Create a new meeting
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, participants, rawCaptions, summary, notes, tags } = req.body;
    
    const newMeeting = new Meeting({
      user: req.user.id,
      title,
      participants,
      rawCaptions,
      summary,
      notes,
      tags
    });
    
    const meeting = await newMeeting.save();
    res.json(meeting);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/meetings
// @desc    Get all meetings for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const meetings = await Meeting.find({ user: req.user.id }).sort({ date: -1 });
    res.json(meetings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/meetings/:id
// @desc    Get meeting by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    // Check if meeting exists
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check if user owns the meeting
    if (meeting.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    res.json(meeting);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT api/meetings/:id
// @desc    Update a meeting
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    // Check if meeting exists
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check if user owns the meeting
    if (meeting.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update fields
    const { title, participants, rawCaptions, summary, notes, tags } = req.body;
    
    if (title) meeting.title = title;
    if (participants) meeting.participants = participants;
    if (rawCaptions) meeting.rawCaptions = rawCaptions;
    if (summary) meeting.summary = summary;
    if (notes) meeting.notes = notes;
    if (tags) meeting.tags = tags;
    
    await meeting.save();
    
    res.json(meeting);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/meetings/:id
// @desc    Delete a meeting
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    // Check if meeting exists
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check if user owns the meeting
    if (meeting.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Use deleteOne instead of deprecated remove()
    await Meeting.deleteOne({ _id: req.params.id });
    
    res.json({ message: 'Meeting removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router; 