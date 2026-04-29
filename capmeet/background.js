// Background script for CapMeet extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('CapMeet extension installed');
});

// Content script is already declared in manifest.json.
// Do not inject content.js from here, or it will run twice and break state.

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle different types of messages
  if (request.action === 'openLoginPage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('login.html') });
  } 
  else if (request.action === 'openSignupPage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('signup.html') });
  }
  else if (request.action === 'openProfilePage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('profile.html') });
  }
});

// Add browser action click handler to open profile or login
chrome.action.onClicked.addListener(() => {
  // Check if user is logged in
  chrome.storage.sync.get(['authToken', 'isLoggedIn'], function(result) {
    if (result.authToken && result.isLoggedIn) {
      // Open profile page if logged in
      chrome.tabs.create({ url: chrome.runtime.getURL('profile.html') });
    } else {
      // Open login page if not logged in
      chrome.tabs.create({ url: chrome.runtime.getURL('login.html') });
    }
  });
});
  