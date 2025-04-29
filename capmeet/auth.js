// auth.js - Handles login and signup functionality

document.addEventListener('DOMContentLoaded', function() {
  // Get server URL from storage
  let backendUrl = 'http://localhost:3000';
  chrome.storage.sync.get(['backendUrl'], function(result) {
    if (result.backendUrl) {
      backendUrl = result.backendUrl;
    }
    console.log('Using backend URL:', backendUrl);
  });

  // Check if we're on the login or signup page
  const isLoginPage = window.location.href.includes('login.html');
  const isSignupPage = window.location.href.includes('signup.html');

  // Check if user is already logged in
  chrome.storage.sync.get(['authToken', 'userData'], function(result) {
    if (result.authToken && result.userData) {
      // User is logged in, redirect to profile page
      window.location.href = 'profile.html';
    }
  });

  // Handle login form submission
  if (isLoginPage) {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      // Basic validation
      if (!email || !password) {
        showError('Please fill in all fields');
        return;
      }
      
      // Attempt login
      login(email, password);
    });
  }
  
  // Handle signup form submission
  if (isSignupPage) {
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      // Basic validation
      if (!username || !email || !password || !confirmPassword) {
        showError('Please fill in all fields');
        return;
      }
      
      if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }
      
      if (password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
      }
      
      // Attempt signup
      signup(username, email, password);
    });
  }
  
  // Login function
  function login(email, password) {
    const url = `${backendUrl}/api/auth/login`;
    console.log('Sending login request to:', url);
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    .then(response => {
      console.log('Login response status:', response.status);
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);
      
      if (contentType && contentType.includes('application/json')) {
        return response.json().then(data => {
          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }
          return data;
        });
      } else {
        throw new Error('Unexpected response from server');
      }
    })
    .then(data => {
      if (data.token) {
        // Get user info
        return fetch(`${backendUrl}/api/auth/user`, {
          headers: {
            'x-auth-token': data.token
          }
        })
        .then(response => {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response.json().then(userData => {
              if (!response.ok) {
                throw new Error('Failed to get user data');
              }
              return { token: data.token, userData };
            });
          } else {
            throw new Error('Unexpected response from server');
          }
        });
      } else {
        throw new Error('No token received');
      }
    })
    .then(({ token, userData }) => {
      // Store auth token and user data
      chrome.storage.sync.set({
        authToken: token,
        userData: userData,
        isLoggedIn: true
      }, function() {
        // Redirect to profile page
        window.location.href = 'profile.html';
      });
    })
    .catch(error => {
      console.error('Login error:', error);
      showError(error.message || 'Login failed. Please try again.');
    });
  }
  
  // Signup function
  function signup(username, email, password) {
    const url = `${backendUrl}/api/auth/register`;
    console.log('Sending signup request to:', url);
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    })
    .then(response => {
      console.log('Signup response status:', response.status);
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);
      
      if (contentType && contentType.includes('application/json')) {
        return response.json().then(data => {
          if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
          }
          return data;
        });
      } else {
        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        // Try to get the response text for more information
        return response.text().then(text => {
          console.error('Response not JSON:', text);
          throw new Error('Unexpected response from server');
        });
      }
    })
    .then(data => {
      if (data.token) {
        // Get user info
        return fetch(`${backendUrl}/api/auth/user`, {
          headers: {
            'x-auth-token': data.token
          }
        })
        .then(response => {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response.json().then(userData => {
              if (!response.ok) {
                throw new Error('Failed to get user data');
              }
              return { token: data.token, userData };
            });
          } else {
            throw new Error('Unexpected response from server');
          }
        });
      } else {
        throw new Error('No token received');
      }
    })
    .then(({ token, userData }) => {
      // Store auth token and user data
      chrome.storage.sync.set({
        authToken: token,
        userData: userData,
        isLoggedIn: true
      }, function() {
        // Redirect to profile page
        window.location.href = 'profile.html';
      });
    })
    .catch(error => {
      console.error('Registration error:', error);
      showError(error.message || 'Registration failed. Please try again.');
    });
  }
  
  // Show error message
  function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.classList.add('visible');
    } else {
      console.error('Error:', message);
    }
  }
}); 