# CapMeet Backend

Backend server for the CapMeet Google Meet caption summarizer extension. This service receives caption data from the Chrome extension and uses Google's Gemini AI to generate meeting summaries. It also provides user authentication and meeting storage capabilities.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create an environment file:
   ```
   cp .env.example .env
   ```

3. Edit the `.env` file and add your configuration:
   ```
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/capmeet
   JWT_SECRET=your_jwt_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
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

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here"
}
```

#### POST /api/auth/login
Login to an existing account.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here"
}
```

#### GET /api/auth/user
Get the authenticated user's information.

**Headers:**
```
x-auth-token: jwt_token_here
```

**Response:**
```json
{
  "_id": "user_id_here",
  "username": "johndoe",
  "email": "john@example.com",
  "createdAt": "2023-06-01T10:15:30.000Z"
}
```

### Meeting Endpoints

#### POST /api/meetings
Create a new meeting record.

**Headers:**
```
x-auth-token: jwt_token_here
```

**Request Body:**
```json
{
  "title": "Project Planning Meeting",
  "participants": ["John Doe", "Jane Smith"],
  "rawCaptions": [
    {
      "speaker": "John Doe",
      "text": "We need to discuss the project timeline.",
      "timestamp": "2023-06-01T10:15:30.000Z"
    }
  ],
  "summary": "Discussion about project timeline concerns",
  "notes": "Need to follow up with Jane about resources",
  "tags": ["planning", "project"]
}
```

#### GET /api/meetings
Get all meetings for the authenticated user.

**Headers:**
```
x-auth-token: jwt_token_here
```

#### GET /api/meetings/:id
Get a specific meeting by ID.

**Headers:**
```
x-auth-token: jwt_token_here
```

#### PUT /api/meetings/:id
Update a meeting record.

**Headers:**
```
x-auth-token: jwt_token_here
```

**Request Body:**
```json
{
  "title": "Updated Meeting Title",
  "notes": "Updated notes content"
}
```

#### DELETE /api/meetings/:id
Delete a meeting record.

**Headers:**
```
x-auth-token: jwt_token_here
```

### Summary Generation

#### GET /
Health check endpoint to verify the server is running.

#### POST /api/summarize
Accepts JSON data of Google Meet captions and returns an AI-generated summary.

**Request Body:**
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

**Response:**
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
3. View and save the AI-generated summary to your account

## Error Handling

- 400 Bad Request: Invalid or missing data
- 401 Unauthorized: Authentication failure
- 404 Not Found: Resource not found
- 500 Internal Server Error: Issues with the AI service or server processing 