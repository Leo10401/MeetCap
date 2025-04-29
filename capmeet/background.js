// Background script for CapMeet extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('CapMeet extension installed');
});

// Listen for tab updates to inject the content script when on Google Meet
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('meet.google.com')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.error('Script injection failed:', err));
  }
});

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
  