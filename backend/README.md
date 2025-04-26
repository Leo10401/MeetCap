# CapMeet Backend

Backend server for the CapMeet Google Meet caption summarizer extension. This service receives caption data from the Chrome extension and uses Google's Gemini AI to generate meeting summaries.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create an environment file:
   ```
   cp  .env
   ```

3. Edit the `.env` file and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-1.5-pro
   ```
   
   You can get a Gemini API key from the [Google AI Studio](https://makersuite.google.com/app/apikey).

4. Start the server:
   ```
   npm start
   ```
   Or for development with automatic reloading:
   ```
   npm run dev
   ```

## API Endpoints

### GET /
Health check endpoint to verify the server is running.

### POST /api/summarize
Accepts JSON data of Google Meet captions and returns an AI-generated summary.

#### Request Body
An array of caption objects with the following structure:
```json
[
  {
    "timestamp": "2023-06-01T10:15:30.000Z",
    "speaker": "John Doe",
    "text": "We need to discuss the project timeline."
  },
  {
    "timestamp": "2023-06-01T10:15:35.000Z",
    "speaker": "Jane Smith",
    "text": "I agree, we're falling behind schedule."
  }
]
```

#### Response
```json
{
  "summary": "John and Jane discussed concerns about falling behind on the project timeline.",
  "originalLength": 2,
  "processedAt": "2023-06-01T10:20:00.000Z"
}
```

## Usage with CapMeet Extension

The Chrome extension will export caption data as JSON. You can then:

1. Save the JSON file from the extension
2. Send it to this backend service for summarization
3. View and save the AI-generated summary

## Error Handling

- 400 Bad Request: Invalid or missing caption data
- 500 Internal Server Error: Issues with the AI service or server processing 