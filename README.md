# MeetCap - Google Meet Caption Saver & Summarizer

MeetCap is a Chrome extension that captures and saves captions from Google Meet meetings, with the additional ability to generate AI-powered summaries of your meeting content.

## Features

- 📝 Capture Google Meet captions with speaker names
- 💾 Save captions locally for future reference
- 📊 Export captions as JSON
- 🧠 Generate AI-powered summaries of meeting content
- ⚙️ Configurable backend connection

## Installation

### Extension Setup

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the `capmeet` directory
5. The extension should now be visible in your Chrome toolbar

### Backend Setup

1. Navigate to the `backend` directory
2. Create a `.env` file with the following content:
   ```
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-1.5-pro
   ```
3. Replace `your_gemini_api_key` with your actual Gemini API key. You can get one from [Google AI Studio](https://makersuite.google.com/)
4. Install dependencies: `npm install`
5. Start the server: `npm start`
6. The backend server should now be running on `http://localhost:3000`

## Usage

1. Join a Google Meet meeting
2. Click the CapMeet icon in the Chrome toolbar to open the sidebar
3. Click "Start Recording Captions" to begin capturing meeting captions
4. The captions will be displayed in real-time in the sidebar
5. When you want to stop recording, click "Stop Recording"
6. To export all captured captions as a JSON file, click "Export Saved Captions"
7. To generate an AI summary of the meeting, click "Summarize with AI"

## Configuration

You can configure the backend URL by clicking the gear icon in the sidebar. By default, it connects to `http://localhost:3000`.

## Privacy & Data Security

This extension:
- Stores caption data in your browser's local storage
- Only sends data to the configured backend server when explicitly requesting a summary
- Does not share data with any third parties (other than the Gemini AI API for summarization)

## Troubleshooting

- If summaries aren't working, ensure the backend server is running and accessible
- Check that your Gemini API key is valid and has sufficient quota
- Verify the backend URL in the extension settings

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- This extension uses the Gemini API for generating AI summaries
- Built with JavaScript, Node.js and Express "# MeetCap" 
