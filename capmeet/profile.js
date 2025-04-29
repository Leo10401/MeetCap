// profile.js - Handles user profile functionality

document.addEventListener('DOMContentLoaded', function() {
  // Get server URL from storage
  let backendUrl = 'http://localhost:3000';
  let authToken = null;
  let userData = null;
  
  // Check if user is logged in
  chrome.storage.sync.get(['authToken', 'userData', 'backendUrl'], function(result) {
    if (result.backendUrl) {
      backendUrl = result.backendUrl;
      document.getElementById('backend-url').value = backendUrl;
    }
    
    if (result.authToken && result.userData) {
      authToken = result.authToken;
      userData = result.userData;
      
      // Display user information
      displayUserInfo(userData);
      
      // Load user's meetings
      loadMeetings();
    } else {
      // Not logged in, redirect to login page
      window.location.href = 'login.html';
    }
  });
  
  // Display user info
  function displayUserInfo(user) {
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email;
    
    // Format creation date
    const createdDate = new Date(user.createdAt);
    document.getElementById('profile-created').textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
  }
  
  // Load user's meetings
  function loadMeetings() {
    fetch(`${backendUrl}/api/meetings`, {
      headers: {
        'x-auth-token': authToken
      }
    })
    .then(response => {
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json().then(data => {
          if (!response.ok) {
            throw new Error(data.message || 'Failed to load meetings');
          }
          return data;
        });
      } else {
        throw new Error('Unexpected response from server');
      }
    })
    .then(meetings => {
      displayMeetings(meetings);
    })
    .catch(error => {
      console.error('Error loading meetings:', error);
      // Show error message to user
      alert('Failed to load meetings: ' + error.message);
    });
  }
  
  // Display user's meetings
  function displayMeetings(meetings) {
    const meetingsContainer = document.getElementById('meetings-container');
    const noMeetingsMessage = document.getElementById('no-meetings-message');
    
    if (meetings && meetings.length > 0) {
      // Hide "no meetings" message
      noMeetingsMessage.style.display = 'none';
      
      // Clear previous content
      meetingsContainer.innerHTML = '';
      
      // Add each meeting
      meetings.forEach(meeting => {
        const meetingElement = document.createElement('div');
        meetingElement.className = 'meeting-item';
        
        // Format date
        const meetingDate = new Date(meeting.date);
        const formattedDate = meetingDate.toLocaleDateString() + ' ' + meetingDate.toLocaleTimeString();
        
        meetingElement.innerHTML = `
          <div class="meeting-title">${meeting.title}</div>
          <div class="meeting-date">${formattedDate}</div>
          <div class="meeting-actions">
            <button class="meeting-view" data-id="${meeting._id}">View</button>
            <button class="meeting-delete" data-id="${meeting._id}">Delete</button>
          </div>
        `;
        
        meetingsContainer.appendChild(meetingElement);
      });
      
      // Add event listeners for meeting actions
      document.querySelectorAll('.meeting-view').forEach(button => {
        button.addEventListener('click', function() {
          const meetingId = this.getAttribute('data-id');
          viewMeeting(meetingId);
        });
      });
      
      document.querySelectorAll('.meeting-delete').forEach(button => {
        button.addEventListener('click', function() {
          const meetingId = this.getAttribute('data-id');
          deleteMeeting(meetingId);
        });
      });
    } else {
      // Show "no meetings" message
      noMeetingsMessage.style.display = 'block';
    }
  }
  
  // View meeting details
  function viewMeeting(meetingId) {
    // For now, just open a new tab to a potential meeting detail page
    // This could be expanded to show details in a modal or separate page
    chrome.tabs.create({
      url: `${backendUrl}/meeting/${meetingId}` // This URL would need to be implemented on the backend
    });
  }
  
  // Delete meeting
  function deleteMeeting(meetingId) {
    if (confirm('Are you sure you want to delete this meeting?')) {
      fetch(`${backendUrl}/api/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': authToken
        }
      })
      .then(response => {
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json().then(data => {
            if (!response.ok) {
              throw new Error(data.message || 'Failed to delete meeting');
            }
            return data;
          });
        } else if (response.ok) {
          // Some APIs return empty response for successful deletion
          return { message: 'Meeting deleted successfully' };
        } else {
          throw new Error('Unexpected response from server');
        }
      })
      .then(() => {
        // Reload meetings list
        loadMeetings();
      })
      .catch(error => {
        console.error('Error deleting meeting:', error);
        alert('Failed to delete meeting: ' + error.message);
      });
    }
  }
  
  // Handle logout
  document.getElementById('logout-button').addEventListener('click', function() {
    // Clear auth data from storage
    chrome.storage.sync.remove(['authToken', 'userData', 'isLoggedIn'], function() {
      // Redirect to login page
      window.location.href = 'login.html';
    });
  });
  
  // Handle settings form submission
  document.getElementById('settings-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newBackendUrl = document.getElementById('backend-url').value.trim();
    
    if (newBackendUrl) {
      // Save to Chrome storage
      chrome.storage.sync.set({ backendUrl: newBackendUrl }, function() {
        alert('Settings saved');
        backendUrl = newBackendUrl;
        
        // Reload meetings with new URL
        loadMeetings();
      });
    }
  });
}); 