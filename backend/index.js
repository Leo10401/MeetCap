const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Google Meet Summarizer API is running' });
});

// Process captions and generate summary
app.post('/api/summarize', async (req, res) => {
  try {
    const captionData = req.body;
    
    // Validate input
    if (!captionData || !Array.isArray(captionData) || captionData.length === 0) {
      return res.status(400).json({ error: 'Invalid caption data. Please provide an array of caption objects.' });
    }
    
    // Extract conversation text from captions
    const conversation = formatConversation(captionData);
    
    // Generate summary using Gemini
    const summary = await generateSummary(conversation);
    
    // Return the summary
    res.status(200).json({ 
      summary,
      originalLength: captionData.length,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing summary request:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary', 
      message: error.message 
    });
  }
});

// Format conversation from caption data
function formatConversation(captionData) {
  // Group consecutive captions by the same speaker
  let formattedConversation = [];
  let currentSpeaker = null;
  let currentMessage = '';
  
  captionData.forEach(caption => {
    if (caption.speaker === currentSpeaker) {
      // Continue the current message
      currentMessage += ' ' + caption.text;
    } else {
      // Save previous message if exists
      if (currentSpeaker) {
        formattedConversation.push(`${currentSpeaker}: ${currentMessage}`);
      }
      
      // Start new message
      currentSpeaker = caption.speaker;
      currentMessage = caption.text;
    }
  });
  
  // Add the last message
  if (currentSpeaker) {
    formattedConversation.push(`${currentSpeaker}: ${currentMessage}`);
  }
  
  return formattedConversation.join('\n');
}

// Generate summary using Gemini API
async function generateSummary(conversation) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.');
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await axios.post(
      apiUrl,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Please summarize the following Google Meet conversation, focusing on key points, decisions, and action items:\n\n${conversation}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
          topP: 0.8,
          topK: 40
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the summary from the Gemini response
    if (response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error('Invalid response structure from Gemini API');
    }
  } catch (error) {
    console.error('Error generating summary with Gemini:', error.response?.data || error.message);
    throw new Error('Failed to generate summary with Gemini AI service');
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Google Meet Summarizer server running on port ${PORT}`);
});
