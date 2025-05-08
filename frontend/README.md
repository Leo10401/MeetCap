# CapMeet - Google Meet History with AI Summaries

CapMeet is a web application that helps you store, organize, and review your Google Meet conversations with AI-powered summaries. The system consists of three main components:

1. **Chrome Extension**: Captures captions from Google Meet sessions, processes them in real-time, and allows immediate summarization.
2. **Backend Server**: Handles authentication, meeting storage, and AI summarization using Gemini API.
3. **Frontend Web Application**: Provides an interface to view meeting history with AI summaries.

## Frontend

The frontend is built with Next.js and Tailwind CSS, providing a responsive and modern user interface.

### Main Features

- User authentication (login/register)
- Dashboard with meeting history
- Detailed meeting view with tabs for AI summary, full transcript, and personal notes
- Search and filter functionality for meetings

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Backend

The backend is a Node.js API server that handles data storage, authentication, and integration with the AI summarization service.

### Main Features

- User authentication with JWT
- Meeting CRUD operations
- AI summarization using Gemini API

### Getting Started

1. Install dependencies:
   ```bash
   cd ../backend
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   PORT=3000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Chrome Extension

The extension captures Google Meet captions in real-time and allows you to:

1. View captions directly within the meeting
2. Generate AI summaries
3. Save meetings to your account

### Installation

Currently, the extension can be loaded in developer mode:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `capmeet` directory

## Integration

All three components work together to provide a seamless experience:

1. The Chrome extension captures captions during Google Meet sessions
2. Users can save meetings to their accounts through the extension
3. The website provides access to the meeting history with AI summaries

## Technologies Used

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **Extension**: JavaScript, Chrome Extensions API
- **AI**: Gemini API

## License

MIT
