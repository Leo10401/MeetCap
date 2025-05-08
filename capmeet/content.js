// content.js - Modified to capture live caption updates more frequently
let captionData = [];
let isRecording = false;
let lastProcessedText = '';
let lastProcessedTimestamp = 0;
let captionObserver = null;
let capturedCaptions = [];
let sidebarInjected = false;
let backendUrl = 'http://localhost:5000'; // Default backend server URL
let authToken = null;
let userData = null;
let isLoggedIn = false;
let debugMode = true; // Set to true to enable additional console logs
let captionProcessTimer = null;

// Initialize when content script loads
console.log('Google Meet Caption Saver initializing...');

// Check if we're in a Google Meet session
function checkForGoogleMeet() {
  const isGoogleMeet = window.location.hostname === 'meet.google.com';
  console.log('Is Google Meet page:', isGoogleMeet, 'URL:', window.location.href);
  return isGoogleMeet;
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, checking for Google Meet...');
  if (checkForGoogleMeet()) {
    initializeExtension();
  } else {
    console.log('Not a Google Meet page, extension will not initialize');
  }
});

// Initialize as soon as possible if document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, checking for Google Meet...');
  if (checkForGoogleMeet()) {
    initializeExtension();
  } else {
    console.log('Not a Google Meet page, extension will not initialize');
  }
}

// Function to initialize the extension
function initializeExtension() {
  console.log('Initializing CapMeet extension in Google Meet...');
  
  // Load settings when extension starts
  chrome.storage.sync.get(['backendUrl', 'authToken', 'userData', 'isLoggedIn'], function(result) {
    if (result.backendUrl) {
      backendUrl = result.backendUrl;
    }
    
    if (result.authToken) {
      authToken = result.authToken;
    }
    
    if (result.userData) {
      userData = result.userData;
    }
    
    isLoggedIn = result.isLoggedIn || false;
    
    // Inject the sidebar into the page
    injectSidebar();
    
    // Start checking for captions after a short delay
    setTimeout(() => {
      console.log('Ready to capture captions in real-time');
      // Initialize all observer methods for maximum coverage
      setupCaptionObserver();
    }, 2000); // Increased delay to allow page to fully load
  });
}

// Function to inject sidebar into Google Meet
function injectSidebar() {
  console.log('Injecting sidebar into Google Meet');
  
  if (sidebarInjected) {
    console.log('Sidebar already injected, skipping');
    return;
  }
  
  try {
    // Inject sidebar CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('sidebar.css');
    document.head.appendChild(cssLink);
    console.log('Sidebar CSS injected');
    
    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'caption-saver-sidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    sidebar.style.width = '300px';
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = 'white';
    sidebar.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.2)';
    sidebar.style.zIndex = '9999';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.transition = 'transform 0.3s ease-in-out';
    sidebar.style.transform = 'translateX(300px)';
    
    // Create sidebar content with auth buttons
    sidebar.innerHTML = `
      <div style="padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 16px;">Google Meet Caption Saver</h2>
        <div>
          <button id="sidebar-settings" style="background: none; border: none; cursor: pointer; margin-right: 5px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button id="sidebar-toggle" style="background: none; border: none; cursor: pointer;">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      <div style="padding: 15px; display: flex; flex-direction: column; height: 100%;">
        <div id="auth-status-container" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div id="auth-status">Not logged in</div>
          <div id="auth-buttons">
            <button id="login-button" style="padding: 5px 10px; background-color: #1a73e8; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 5px;">Login</button>
            <button id="signup-button" style="padding: 5px 10px; background-color: #34a853; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Sign Up</button>
          </div>
          <div id="profile-button" style="display: none;">
            <button id="view-profile" style="padding: 5px 10px; background-color: #1a73e8; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">My Profile</button>
          </div>
        </div>
        <button id="sidebar-record-button" style="padding: 8px 12px; margin-bottom: 10px; width: 100%; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Start Recording Captions
        </button>
        <button id="sidebar-export-button" style="padding: 8px 12px; margin-bottom: 10px; width: 100%; background-color: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Export Saved Captions
        </button>
        <button id="sidebar-summarize-button" style="padding: 8px 12px; margin-bottom: 10px; width: 100%; background-color: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Summarize with AI
        </button>
        <button id="sidebar-save-meeting-button" style="padding: 8px 12px; margin-bottom: 15px; width: 100%; background-color: #F9A825; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
          Save Meeting to Account
        </button>
        <div id="sidebar-status" style="margin-bottom: 10px;">Not recording</div>
        <div style="border-top: 1px solid #ddd; padding-top: 10px; flex: 1; display: flex; flex-direction: column;">
          <h3 style="font-size: 14px; margin-top: 0;">Live Captions</h3>
          <div id="sidebar-captions-list" style="flex: 1; overflow-y: auto;">
            <p class="no-captions">No captions yet. Start recording to capture captions.</p>
          </div>
        </div>
        <div id="summary-container" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; display: none;">
          <h3 style="font-size: 14px; margin-top: 0;">AI Summary</h3>
          <div id="summary-content" style="max-height: 200px; overflow-y: auto; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
            No summary available yet.
          </div>
        </div>
      </div>
    `;
    
    // Add sidebar to the page
    document.body.appendChild(sidebar);
    console.log('Sidebar container added to page');
    
    // Create settings modal
    const settingsModal = document.createElement('div');
    settingsModal.id = 'settings-modal';
    settingsModal.style.display = 'none';
    settingsModal.style.position = 'fixed';
    settingsModal.style.zIndex = '10000';
    settingsModal.style.left = '0';
    settingsModal.style.top = '0';
    settingsModal.style.width = '100%';
    settingsModal.style.height = '100%';
    settingsModal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    settingsModal.innerHTML = `
      <div style="position: relative; background-color: white; margin: 15% auto; padding: 20px; width: 400px; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        <button id="close-settings" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer;">×</button>
        <h3 style="margin-top: 0;">Settings</h3>
        <div style="margin-bottom: 15px;">
          <label for="backend-url" style="display: block; margin-bottom: 5px;">Backend Server URL:</label>
          <input id="backend-url" type="text" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${backendUrl}">
        </div>
        <button id="save-settings" style="padding: 8px 16px; background-color: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Settings</button>
      </div>
    `;
    document.body.appendChild(settingsModal);
    console.log('Settings modal added to page');
    
    // Add sidebar toggle button to the page
    const toggleButton = document.createElement('button');
    toggleButton.id = 'caption-saver-toggle';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '9998';
    toggleButton.style.backgroundColor = '#1a73e8';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.width = '48px';
    toggleButton.style.height = '48px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toggleButton.innerHTML = `
  <svg width="36px" height="36px" viewBox="0 0 400.00 400.00" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0)"><g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(14,14), scale(0.93)"><rect x="0" y="0" width="400.00" height="400.00" rx="200" fill="#00ccaa" strokewidth="0"></rect></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="3.2"></g><g id="SVGRepo_iconCarrier"> <path d="M97.8357 54.6682C177.199 59.5311 213.038 52.9891 238.043 52.9891C261.298 52.9891 272.24 129.465 262.683 152.048C253.672 173.341 100.331 174.196 93.1919 165.763C84.9363 156.008 89.7095 115.275 89.7095 101.301" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3318 190.694C-10.6597 291.485 121.25 273.498 148.233 295.083" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3301 190.694C99.7917 213.702 101.164 265.697 100.263 272.898" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M208.308 136.239C208.308 131.959 208.308 127.678 208.308 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M177.299 137.271C177.035 133.883 177.3 126.121 177.3 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.398 241.72C352.097 239.921 374.881 226.73 312.524 341.851" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M285.55 345.448C196.81 341.85 136.851 374.229 178.223 264.504" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M180.018 345.448C160.77 331.385 139.302 320.213 120.658 304.675" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C219.024 205.562 219.594 220.898 219.594 236.324" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C225.896 202.037 232.97 209.77 241.777 230.327" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M80.1174 119.041C75.5996 120.222 71.0489 119.99 66.4414 120.41" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M59.5935 109.469C59.6539 117.756 59.5918 125.915 58.9102 134.086" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M277.741 115.622C281.155 115.268 284.589 114.823 287.997 114.255" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M291.412 104.682C292.382 110.109 292.095 115.612 292.095 121.093" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M225.768 116.466C203.362 113.993 181.657 115.175 160.124 118.568" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
    `;
    document.body.appendChild(toggleButton);
    console.log('Toggle button added to page');
    
    // Create download link element (hidden)
    const downloadLink = document.createElement('a');
    downloadLink.id = 'sidebar-download-link';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // Set up event listeners
    console.log('Setting up sidebar event listeners');
    
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('caption-saver-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-record-button').addEventListener('click', toggleRecording);
    document.getElementById('sidebar-export-button').addEventListener('click', exportCaptions);
    document.getElementById('sidebar-summarize-button').addEventListener('click', summarizeCaptions);
    document.getElementById('sidebar-settings').addEventListener('click', toggleSettings);
    document.getElementById('close-settings').addEventListener('click', toggleSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('login-button').addEventListener('click', openLoginPage);
    document.getElementById('signup-button').addEventListener('click', openSignupPage);
    document.getElementById('view-profile').addEventListener('click', openProfilePage);
    document.getElementById('sidebar-save-meeting-button').addEventListener('click', saveMeetingToAccount);
    
    // Update auth status display
    updateAuthDisplay();
    
    sidebarInjected = true;
    console.log('Sidebar successfully injected');
    
    // Load initial caption data
    loadSavedCaptions();
    
    // Automatically show the sidebar after injection
    setTimeout(() => {
      console.log('Automatically showing sidebar');
      toggleSidebar();
    }, 1000);
  } catch (error) {
    console.error('Error injecting sidebar:', error);
  }
}

// Update authentication display
function updateAuthDisplay() {
  const authStatus = document.getElementById('auth-status');
  const authButtons = document.getElementById('auth-buttons');
  const profileButton = document.getElementById('profile-button');
  const saveMeetingButton = document.getElementById('sidebar-save-meeting-button');
  
  chrome.storage.sync.get(['authToken', 'userData', 'isLoggedIn'], function(result) {
    if (result.isLoggedIn && result.authToken && result.userData) {
      // User is logged in
      authToken = result.authToken;
      userData = result.userData;
      isLoggedIn = true;
      
      authStatus.textContent = `Logged in as: ${result.userData.username}`;
      authButtons.style.display = 'none';
      profileButton.style.display = 'block';
      
      // Show the save meeting button if there's a summary
      const summaryContainer = document.getElementById('summary-container');
      if (summaryContainer && summaryContainer.style.display !== 'none') {
        saveMeetingButton.style.display = 'block';
      }
    } else {
      // User is not logged in
      authStatus.textContent = 'Not logged in';
      authButtons.style.display = 'block';
      profileButton.style.display = 'none';
      saveMeetingButton.style.display = 'none';
    }
  });
}

// Open login page
function openLoginPage() {
  chrome.runtime.sendMessage({ action: 'openLoginPage' });
}

// Open signup page
function openSignupPage() {
  chrome.runtime.sendMessage({ action: 'openSignupPage' });
}

// Open profile page
function openProfilePage() {
  chrome.runtime.sendMessage({ action: 'openProfilePage' });
}

// Save meeting to user's account
function saveMeetingToAccount() {
  if (!isLoggedIn || !authToken) {
    alert('You must be logged in to save meetings to your account.');
    return;
  }
  
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent || summaryContent.textContent === 'No summary available yet.') {
    alert('Please generate a summary first before saving the meeting.');
    return;
  }
  
  // Create a title for the meeting using the current date and time
  const now = new Date();
  const meetingTitle = `Google Meet - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  
  // Extract participant names from captions
  const participants = [];
  captionData.forEach(caption => {
    if (caption.speaker && !participants.includes(caption.speaker)) {
      participants.push(caption.speaker);
    }
  });
  
  // Create meeting data
  const meetingData = {
    title: meetingTitle,
    participants: participants,
    rawCaptions: captionData,
    summary: summaryContent.textContent,
    notes: '',  // User can add notes later
    tags: ['Google Meet', 'Auto-saved']
  };
  
  // Send to backend
  fetch(`${backendUrl}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken
    },
    body: JSON.stringify(meetingData)
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.message || 'Failed to save meeting');
      });
    }
    return response.json();
  })
  .then(data => {
    alert('Meeting saved successfully to your account!');
  })
  .catch(error => {
    console.error('Error saving meeting:', error);
    alert('Failed to save meeting: ' + error.message);
  });
}

// Toggle settings modal
function toggleSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    if (modal.style.display === 'none') {
      // Update input value with current backend URL
      const urlInput = document.getElementById('backend-url');
      if (urlInput) {
        urlInput.value = backendUrl;
      }
      modal.style.display = 'block';
    } else {
      modal.style.display = 'none';
    }
  }
}

// Save settings
function saveSettings() {
  const urlInput = document.getElementById('backend-url');
  if (urlInput && urlInput.value.trim()) {
    backendUrl = urlInput.value.trim();
    
    // Save to Chrome storage
    chrome.storage.sync.set({ backendUrl: backendUrl }, function() {
      // Update status
      const statusElement = document.getElementById('sidebar-status');
      if (statusElement) {
        statusElement.textContent = "Settings saved";
        setTimeout(() => {
          if (!isRecording) {
            statusElement.textContent = "Not recording";
          } else {
            statusElement.textContent = "Recording in progress...";
          }
        }, 2000);
      }
    });
    
    // Close the modal
    toggleSettings();
  }
}

// Toggle sidebar
function toggleSidebar() {
  console.log('Toggle sidebar called');
  const sidebar = document.getElementById('caption-saver-sidebar');
  if (sidebar) {
    // Check if sidebar is currently hidden
    const isHidden = sidebar.style.transform === 'translateX(300px)';
    
    // Toggle sidebar visibility
    sidebar.style.transform = isHidden ? 'translateX(0)' : 'translateX(300px)';
    console.log('Sidebar visibility toggled, now', isHidden ? 'visible' : 'hidden');
  } else {
    console.error('Could not find sidebar element');
  }
}

// Toggle recording
function toggleRecording() {
  console.log('Toggle recording clicked, current state:', isRecording);
  
  const recordButton = document.getElementById('sidebar-record-button');
  const statusElement = document.getElementById('sidebar-status');
  const captionsList = document.getElementById('sidebar-captions-list');
  
  if (isRecording) {
    stopRecording();
    
    if (recordButton) {
      recordButton.textContent = "Start Recording Captions";
      recordButton.style.backgroundColor = "#4CAF50";
    }
    
    if (statusElement) {
      statusElement.textContent = "Not recording";
    }
    
    console.log('Recording stopped');
  } else {
    // Clear the captions list display when starting new recording
    if (captionsList) {
      captionsList.innerHTML = '<p class="no-captions">Starting new recording session...</p>';
      console.log('Cleared captions list');
    }
    
    startRecording();
    
    if (recordButton) {
      recordButton.textContent = "Stop Recording";
      recordButton.style.backgroundColor = "#f44336";
    }
    
    if (statusElement) {
      statusElement.textContent = "Recording in progress...";
    }
    
    console.log('Recording started');
  }
}

// Export captions
function exportCaptions() {
  if (captionData.length === 0) {
    alert('No captions to export. Please record some captions first.');
    return;
  }
  
  // Create JSON string from caption data
  const jsonData = JSON.stringify(captionData, null, 2);
  
  // Create Blob from JSON string
  const blob = new Blob([jsonData], { type: 'application/json' });
  
  // Create URL for Blob
  const url = URL.createObjectURL(blob);
  
  // Get download link element
  const downloadLink = document.getElementById('sidebar-download-link');
  
  if (downloadLink) {
    // Set link attributes
    downloadLink.href = url;
    downloadLink.download = `google-meet-captions-${new Date().toISOString().split('T')[0]}.json`;
    
    // Click the link to download
    downloadLink.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  }
}

// Load saved captions
function loadSavedCaptions() {
  chrome.storage.local.get(['captionData'], function(result) {
    if (result.captionData && Array.isArray(result.captionData)) {
      captionData = result.captionData;
      
      // Update sidebar captions list
      const captionsList = document.getElementById('sidebar-captions-list');
      
      if (captionsList) {
        // Clear current captions
        captionsList.innerHTML = '';
        
        if (captionData.length > 0) {
          // Add each caption to the sidebar
          captionData.forEach(caption => {
            addCaptionToSidebar(caption);
          });
        } else {
          // Show "no captions" message
          captionsList.innerHTML = '<p class="no-captions">No captions yet. Start recording to capture captions.</p>';
        }
      }
    }
  });
}

// Function to add caption to sidebar
function addCaptionToSidebar(caption) {
  console.log('Adding caption to sidebar:', caption);
  
  if (!sidebarInjected) {
    console.log('Sidebar not injected, cannot add caption');
    return;
  }
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) {
    console.error('Cannot find captions list element in sidebar');
    return;
  }
  
  // Debug: Check what we're getting
  console.log('Caption data to add:', JSON.stringify(caption));
  console.log('Current sidebar content:', captionsList.innerHTML);
  
  try {
    // Remove "No captions" message if present
    const noCaption = captionsList.querySelector('.no-captions');
    if (noCaption) {
      captionsList.removeChild(noCaption);
    }
    
    // Fix for caption ID
    const uniqueId = caption.id || `caption-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create caption element
    const captionElement = document.createElement('div');
    captionElement.id = uniqueId.startsWith('caption-') ? uniqueId : `caption-${uniqueId}`;
    captionElement.className = 'caption-entry';
    captionElement.style.marginBottom = '8px';
    captionElement.style.borderBottom = '1px solid #eee';
    captionElement.style.paddingBottom = '8px';
    
    // Add timestamp (in a human-readable format)
    const time = new Date(caption.timestamp);
    const timeElement = document.createElement('div');
    timeElement.className = 'caption-time';
    timeElement.style.fontSize = '11px';
    timeElement.style.color = '#5f6368';
    timeElement.style.marginBottom = '2px';
    timeElement.textContent = time.toLocaleTimeString();
    
    // Add speaker
    const speakerElement = document.createElement('span');
    speakerElement.className = 'caption-speaker';
    speakerElement.style.fontWeight = 'bold';
    speakerElement.style.color = '#1a73e8';
    speakerElement.textContent = caption.speaker + ': ';
    
    // Add text
    const textElement = document.createElement('span');
    textElement.className = 'caption-text';
    textElement.textContent = caption.text;
    
    // Assemble the caption element
    const contentElement = document.createElement('div');
    contentElement.appendChild(speakerElement);
    contentElement.appendChild(textElement);
    
    captionElement.appendChild(timeElement);
    captionElement.appendChild(contentElement);
    
    // Add to the list
    captionsList.appendChild(captionElement);
    
    // Scroll to bottom to show latest caption
    captionsList.scrollTop = captionsList.scrollHeight;
    
    // Limit the number of displayed captions to avoid performance issues
    const maxDisplayedCaptions = 50;
    const entries = captionsList.querySelectorAll('.caption-entry');
    if (entries.length > maxDisplayedCaptions) {
      for (let i = 0; i < entries.length - maxDisplayedCaptions; i++) {
        captionsList.removeChild(entries[i]);
      }
    }
    
    console.log('Caption successfully added to sidebar');
  } catch (error) {
    console.error('Error adding caption to sidebar:', error);
  }
}

// Function to start recording captions
function startRecording() {
  isRecording = true;
  console.log('Caption recording started - isRecording set to', isRecording);
  
  // Clear previous caption data
  captionData = [];
  capturedCaptions = [];
  console.log('Previous caption data cleared');
  
  // Clear previously saved captions from storage
  clearPreviousCaptions();
  
  // Set up the caption observer right away
  setupCaptionObserver();
  
  // Notify popup that recording has started
  chrome.runtime.sendMessage({action: "recordingStatus", status: true});
  
  // Update status in sidebar
  const statusElement = document.getElementById('sidebar-status');
  if (statusElement) {
    statusElement.textContent = 'Recording in progress...';
  }
}

// Function to clear previously saved captions
function clearPreviousCaptions() {
  chrome.storage.local.get(null, function(items) {
    const keysToRemove = Object.keys(items).filter(key => key.startsWith('meet_captions_'));
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, function() {
        console.log('Previous captions cleared:', keysToRemove.length, 'sessions removed');
        // Notify popup that captions were cleared
        chrome.runtime.sendMessage({action: "captionsCleared"});
      });
    }
  });
}

// Function to stop recording captions
function stopRecording() {
  isRecording = false;
  console.log('Caption recording stopped');
  
  // Stop the caption observer
  if (captionObserver) {
    captionObserver.disconnect();
    captionObserver = null;
  }
  
  // Save the captured caption data
  saveCaptionData();
  
  // Notify popup that recording has stopped
  chrome.runtime.sendMessage({action: "recordingStatus", status: false});
}

// Function to save caption data to local storage
function saveCaptionData() {
  if (capturedCaptions.length > 0) {
    const timestamp = new Date().toISOString();
    const key = `meet_captions_${timestamp}`;
    
    chrome.storage.local.set({[key]: capturedCaptions}, function() {
      console.log('Captions saved:', capturedCaptions.length, 'entries');
      chrome.runtime.sendMessage({
        action: "captionsSaved", 
        timestamp: timestamp,
        count: capturedCaptions.length
      });
    });
  }
}

// Extract speaker name from caption element - improved version
function extractSpeakerName(captionElement) {
  // First try to find speaker elements with known class names
  const speakerSelectors = [
    '.NWpY1d', '.zs7s8d', '.YTbUzc', '.KcIKyf.jxFHg',
    '.KcIKyf', 'span.NWpY1d', 'span.zs7s8d'
  ];
  
  for (const selector of speakerSelectors) {
    const speakerElement = captionElement.querySelector(selector);
    if (speakerElement) {
      // Look for child elements that might contain the speaker name
      const possibleNameElements = speakerElement.querySelectorAll('span, div');
      
      if (possibleNameElements.length > 0) {
        // Try to get name from first child element
        for (const elem of possibleNameElements) {
          const speakerName = elem.textContent.trim();
          if (speakerName && speakerName !== ':' && !speakerName.endsWith(':')) {
            return speakerName.replace(/[:：]$/, '').trim();
          }
        }
      }
      
      // If no suitable child element, try the element itself
      let speakerName = speakerElement.textContent.trim();
      // Remove colon if present
      speakerName = speakerName.replace(/[:：]$/, '').trim();
      if (speakerName) return speakerName;
    }
  }
  
  // Next, try to find speaker name from parent element structure
  const parentElement = captionElement.parentElement;
  if (parentElement) {
    const speakerElems = parentElement.querySelectorAll('span.NWpY1d');
    for (const elem of speakerElems) {
      if (elem.textContent && elem.textContent.trim()) {
        return elem.textContent.trim().replace(/[:：]$/, '');
      }
    }
  }
  
  // If not found, try parsing from the caption text content
  const fullText = captionElement.textContent.trim();
  
  // Look for patterns like "Name: text" or "Name："
  const colonMatch = fullText.match(/^([^:：]+)[：:]\s*(.+)$/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }
  
  // For the screenshot pattern you showed
  const captionContainer = captionElement.closest('[role="region"][aria-label="Captions"], .KcIKyf, .bh44bd');
  if (captionContainer) {
    // Look for speaker indicators (like "You:" or "Pramod:")
    const speakerIndicators = captionContainer.querySelectorAll('span.NWpY1d');
    for (const indicator of speakerIndicators) {
      const name = indicator.textContent.trim().replace(/[:：]$/, '');
      if (name) return name;
    }
  }
  
  return "Unknown";
}

// Find the caption container in the DOM
function findCaptionContainer() {
  const containerSelectors = [
    'div[role="region"][aria-label="Captions"]',
    '.nMcdL.bj4p3b',
    '.adE6rb',
    '.iOzk7'
  ];
  
  for (const selector of containerSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      console.log(`Found caption container with selector: ${selector}`);
      return container;
    }
  }
  
  console.log('Could not find caption container with any known selector');
  return null;
}

// Check if text is likely UI text rather than captions
function isLikelyUIText(text) {
  if (!text) return true;
  
  // Skip very short text (likely UI elements)
  if (text.length < 3) {
    console.log(`Detected UI text: "${text}" (too short)`);
    return true;
  }
  
  const uiKeywords = [
    'button', 'menu', 'click', 'settings', 'meeting', 'leave', 
    'join', 'mute', 'unmute', 'camera', 'microphone', 'share',
    'present', 'raise hand', 'participants', 'chat', 'more',
    'turn on', 'turn off', 'settings', 'people', 'recording',
    'presenter', 'host', 'is presenting', 'is muted', 'notifications',
    'is sharing', 'has turned', 'you are', 'live', 'caption',
    'connected', 'controls', 'entered', 'left', 'everyone'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for exact UI element matches
  for (const keyword of uiKeywords) {
    if (lowerText === keyword || lowerText.includes(` ${keyword} `)) {
      console.log(`Detected UI text: "${text}" (matched keyword: ${keyword})`);
      return true;
    }
  }
  
  // Check for Hindi UI text
  const hindiUIPattern = /^हेलो$/i;
  if (hindiUIPattern.test(text)) {
    console.log(`Detected UI text: "${text}" (matched Hindi UI pattern)`);
    return true;
  }
  
  // Check for other UI patterns
  if (/^\d+$/.test(text) || // Just numbers
      /^[^\w\s]+$/.test(text) || // Just symbols
      /^\w+:$/.test(text)) { // Just a word with colon
    console.log(`Detected UI text: "${text}" (matches UI pattern)`);
    return true;
  }
  
  console.log(`Valid caption text: "${text}"`);
  return false;
}

// Process all captions in the container
function processCaptions() {
  console.log('Processing captions, isRecording:', isRecording);
  
  if (!isRecording) {
    console.log('Not recording, skipping caption processing');
    return;
  }

  const container = findCaptionContainer();
  if (!container) {
    console.log('No caption container found');
    return;
  }
  
  try {
    // Get all caption elements using the specific class names
    const captionElements = container.querySelectorAll('.bh44bd.VbkSUe, .KcIKyf.jxFHg, .KcIKyf, .nMcdL.bj4p3b');
    
    console.log(`Found ${captionElements.length} caption elements`);
    
    if (!captionElements || captionElements.length === 0) {
      console.log('No caption elements found in container');
      return;
    }
    
    // Get the latest caption element
    const latestCaptionElement = Array.from(captionElements).pop();
    if (!latestCaptionElement) {
      console.log('Could not get latest caption element');
      return;
    }
    
    // Get the complete caption text
    const textElement = latestCaptionElement.querySelector('.bh44bd.VbkSUe') || latestCaptionElement;
    const newText = textElement.textContent.trim();
    
    console.log('Raw caption text found:', newText);
    
    // If text is identical to what we've already processed, skip it
    if (newText === lastProcessedText) {
      console.log('Skipping duplicate caption text');
      return;
    }
    
    // Use our improved extract function to get speaker name
    const speakerName = extractSpeakerName(latestCaptionElement);
    console.log('Extracted speaker name:', speakerName);
    
    // Remove speaker name from text if present
    let captionText = newText;
    if (speakerName !== 'Unknown') {
      // Try different separator patterns
      captionText = newText.replace(`${speakerName}:`, '')
                          .replace(`${speakerName}：`, '')
                          .replace(`${speakerName} :`, '')
                          .replace(`${speakerName} ：`, '')
                          .trim();
    }
    
    // If the caption text is still the same as newText and contains a colon,
    // try to extract speaker name and text
    if (captionText === newText && newText.includes(':')) {
      const parts = newText.split(':');
      if (parts.length >= 2) {
        captionText = parts.slice(1).join(':').trim();
      }
    }
    
    console.log('Processed caption text:', captionText);
    
    // Skip if we don't have meaningful text or if it's UI text
    if (!captionText) {
      console.log('Skipping empty caption');
      return;
    }
    
    // Only do UI text check if it's not clearly someone speaking
    if (captionText.length < 10 && isLikelyUIText(captionText)) {
      console.log('Skipping likely UI text');
      return;
    }
    
    // Update last processed text
    lastProcessedText = newText;
    
    // Handle continuous speech from the same speaker
    let updatedExistingCaption = false;
    let currentCaptionId = '';
    
    // Check if the last caption was from the same speaker
    if (capturedCaptions.length > 0) {
      const lastCaption = capturedCaptions[capturedCaptions.length - 1];
      if (lastCaption.speaker === speakerName) {
        // This is the same speaker continuing to talk
        console.log('Same speaker continuing, updating existing caption');
        
        // Check if the new text is completely different or a continuation
        // If it's very different, it might be a new thought - start a new caption
        // If it's similar or an extension, update the existing caption
        
        const lastText = lastCaption.text;
        // If the new text contains what we already had (or vice versa), it's likely a continuation
        const isContinuation = lastText.includes(captionText) || 
                               captionText.includes(lastText) ||
                               // Check if they share a significant portion of words
                               checkTextSimilarity(lastText, captionText);
                               
        if (isContinuation) {
          // Update the existing caption - always keep the longer text
          if (captionText.length > lastText.length) {
            lastCaption.text = captionText;
          }
          lastCaption.timestamp = new Date().toISOString();
          
          currentCaptionId = lastCaption.id;
          updatedExistingCaption = true;
          
          // Update in the sidebar
          updateSidebarCaption(lastCaption);
        }
      }
    }
    
    // If we haven't updated an existing caption, create a new one
    if (!updatedExistingCaption) {
      // Generate a unique ID for this caption
      const captionId = `caption-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      currentCaptionId = captionId;
      
      console.log('Adding new caption with ID:', captionId);
      
      // Add new caption
      const newCaption = {
        timestamp: new Date().toISOString(),
        speaker: speakerName,
        text: captionText,
        id: captionId
      };
      
      capturedCaptions.push(newCaption);
      
      // Also add to captionData for compatibility
      captionData.push({
        speaker: speakerName,
        text: captionText,
        timestamp: new Date().toISOString(),
        id: captionId
      });
      
      // Add to sidebar
      addCaptionToSidebar(newCaption);
    }
    
    // Save more frequently
    if (capturedCaptions.length % 3 === 0 || updatedExistingCaption) {
      saveCaptionData();
    }
  } catch (error) {
    console.error('Error processing captions:', error);
  }
}

// Helper function to check if two texts are similar enough to be considered a continuation
function checkTextSimilarity(text1, text2) {
  // Simple word-based similarity check
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  // Count common words
  const commonWords = words1.filter(word => words2.includes(word));
  
  // Get the shorter text's word count
  const minLength = Math.min(words1.length, words2.length);
  
  // If at least 30% of the words are common, consider it similar
  return commonWords.length >= minLength * 0.3;
}

// Function to update caption in sidebar
function updateSidebarCaption(caption) {
  console.log('Updating sidebar caption:', caption.id);
  
  if (!sidebarInjected) {
    console.log('Sidebar not injected, cannot update caption');
    return;
  }
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) {
    console.log('Caption list element not found');
    return;
  }
  
  // Debug: Check what we're updating to
  console.log('Updating caption data:', JSON.stringify(caption));
  
  try {
    // Look for existing caption with this ID
    const captionId = caption.id || '';
    const elementId = captionId.startsWith('caption-') ? captionId : `caption-${captionId}`;
    
    // Find the element
    const captionElement = document.getElementById(elementId);
    
    if (captionElement) {
      // Update the text content
      const textElement = captionElement.querySelector('.caption-text');
      if (textElement) {
        textElement.textContent = caption.text;
        
        // Update the timestamp display
        const timeElement = captionElement.querySelector('.caption-time');
        if (timeElement) {
          const time = new Date(caption.timestamp);
          timeElement.textContent = time.toLocaleTimeString();
        }
        
        // Make the element briefly flash to show it was updated
        captionElement.style.transition = 'background-color 0.3s';
        captionElement.style.backgroundColor = '#f0f9ff';
        setTimeout(() => {
          captionElement.style.backgroundColor = 'transparent';
        }, 300);
        
        console.log('Updated existing caption in sidebar');
        
        // Scroll to the element
        captionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        console.log('Text element not found within caption element');
      }
    } else {
      // If not found, add it as a new caption
      console.log('Caption element not found, adding as new');
      addCaptionToSidebar(caption);
    }
  } catch (error) {
    console.error('Error updating caption in sidebar:', error);
    // Try to add it as new if update fails
    try {
      addCaptionToSidebar(caption);
    } catch (e) {
      console.error('Failed to fall back to adding caption:', e);
    }
  }
}

// Set up mutation observer for captions
function setupCaptionObserver() {
  console.log('Setting up caption observer');
  
  if (captionObserver) {
    captionObserver.disconnect();
    console.log('Previous observer disconnected');
  }
  
  captionObserver = new MutationObserver((mutations) => {
    if (isRecording) {
      try {
        const hasCaptionChanges = mutations.some(mutation => {
          // Check if the mutation is happening in a caption container or related to captions
          let isInCaptionContainer = false;
          
          try {
            // Safe check for closest method
            if (mutation.target && typeof mutation.target.closest === 'function') {
              isInCaptionContainer = !!mutation.target.closest('[role="region"][aria-label="Captions"], .nMcdL.bj4p3b, .adE6rb, .iOzk7, .bh44bd, .KcIKyf');
            }
          } catch (e) {
            console.log('Error checking caption container:', e);
          }
          
          // Check for changes in child elements or attributes
          const hasRelevantChanges = mutation.type === 'childList' || 
                                    (mutation.type === 'characterData' && mutation.target && mutation.target.textContent && mutation.target.textContent.trim());
          
          return isInCaptionContainer || hasRelevantChanges;
        });
        
        if (hasCaptionChanges) {
          console.log('Caption changes detected, processing...');
          // Use a short debounce to avoid processing captions too frequently
          clearTimeout(captionProcessTimer);
          captionProcessTimer = setTimeout(processCaptions, 250);
        }
      } catch (error) {
        console.error('Error in mutation observer:', error);
      }
    }
  });
  
  // Look for the caption container
  const captionContainer = findCaptionContainer() || document.body;
  
  // Observe the container or fall back to the entire body if not found
  captionObserver.observe(captionContainer, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });
  
  console.log('Caption observer started, observing:', captionContainer.tagName);
  
  // Try an initial caption processing
  setTimeout(processCaptions, 1000);
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    startRecording();
    sendResponse({status: "started"});
  } else if (message.action === "stopRecording") {
    stopRecording();
    sendResponse({status: "stopped"});
  } else if (message.action === "getStatus") {
    sendResponse({isRecording: isRecording});
  } else if (message.action === "saveCaptionsNow") {
    // Added new action to force save captions immediately
    saveCaptionData();
    sendResponse({status: "saved"});
  }
  return true;
});

// Summarize captions using backend AI service
function summarizeCaptions() {
  if (captionData.length === 0) {
    alert('No captions to summarize. Please record some captions first.');
    return;
  }
  
  const statusElement = document.getElementById('sidebar-status');
  const summaryContainer = document.getElementById('summary-container');
  const summaryContent = document.getElementById('summary-content');
  const saveMeetingButton = document.getElementById('sidebar-save-meeting-button');
  
  if (statusElement && summaryContainer && summaryContent) {
    // Update status
    statusElement.textContent = "Generating summary...";
    
    // Make summary container visible
    summaryContainer.style.display = 'block';
    summaryContent.textContent = 'Generating summary, please wait...';
    
    // Send captions to backend for summarization
    fetch(`${backendUrl}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(captionData)
    })
    .then(async response => {
      const text = await response.text();
      console.log('Response:', text);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }
      return JSON.parse(text);
    })
    .then(data => {
      // Update summary content
      summaryContent.textContent = data.summary;
      
      // Update status
      statusElement.textContent = "Summary generated";
      setTimeout(() => {
        if (!isRecording) {
          statusElement.textContent = "Not recording";
        } else {
          statusElement.textContent = "Recording in progress...";
        }
      }, 2000);
      
      // Show the "Save Meeting" button if user is logged in
      if (isLoggedIn && authToken) {
        saveMeetingButton.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error generating summary:', error);
      summaryContent.textContent = 'Error generating summary. Please try again.';
      
      // Update status
      statusElement.textContent = "Error generating summary";
      setTimeout(() => {
        if (!isRecording) {
          statusElement.textContent = "Not recording";
        } else {
          statusElement.textContent = "Recording in progress...";
        }
      }, 2000);
    });
  }
}