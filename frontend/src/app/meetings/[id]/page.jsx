'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';

export default function MeetingDetailPage({ params }) {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('summary'); // summary, transcript, notes
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const { id } = params;
  
  // Function to fetch meeting details from the API
  const fetchMeeting = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/meetings/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch meeting details');
      }
      
      const data = await response.json();
      setMeeting(data);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
      setError('Failed to load meeting details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load meeting details when component mounts
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (token && id) {
      fetchMeeting();
    }
  }, [token, id, authLoading, isAuthenticated, router]);
  
  // Format date to a readable string
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Handle tab changes
  const handleTabChange = (newTab) => {
    setTab(newTab);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center py-12">
            <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-sm text-gray-500">Loading meeting details...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-red-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="mt-2 text-sm text-red-500">{error}</p>
            <button
              onClick={fetchMeeting}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 ml-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!meeting) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Meeting not found</h3>
            <p className="mt-1 text-sm text-gray-500">
              The meeting you are looking for might have been removed or does not exist.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-grow py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-6 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          
          {/* Meeting Header */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h1 className="text-xl font-semibold text-gray-900">{meeting.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {formatDate(meeting.date)}
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Participants</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {meeting.participants && meeting.participants.length > 0 
                      ? meeting.participants.join(', ') 
                      : 'No participants recorded'}
                  </dd>
                </div>
                {meeting.tags && meeting.tags.length > 0 && (
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Tags</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <div className="flex flex-wrap gap-2">
                        {meeting.tags.map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleTabChange('summary')}
                className={`${
                  tab === 'summary'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                aria-current={tab === 'summary' ? 'page' : undefined}
              >
                AI Summary
              </button>
              <button
                onClick={() => handleTabChange('transcript')}
                className={`${
                  tab === 'transcript'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                aria-current={tab === 'transcript' ? 'page' : undefined}
              >
                Transcript
              </button>
              <button
                onClick={() => handleTabChange('notes')}
                className={`${
                  tab === 'notes'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                aria-current={tab === 'notes' ? 'page' : undefined}
              >
                Notes
              </button>
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="mt-6">
            {tab === 'summary' && (
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">AI-Generated Summary</h3>
                  {meeting.summary ? (
                    <div className="mt-4 text-sm text-gray-500 prose max-w-none">
                      <p className="whitespace-pre-line">{meeting.summary}</p>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>No summary available for this meeting.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {tab === 'transcript' && (
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Meeting Transcript</h3>
                  {meeting.rawCaptions && meeting.rawCaptions.length > 0 ? (
                    <div className="mt-4 text-sm">
                      <ul className="divide-y divide-gray-200">
                        {meeting.rawCaptions.map((caption, index) => (
                          <li key={index} className="py-3">
                            <div className="flex space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-500">
                                    {caption.speaker ? caption.speaker.charAt(0).toUpperCase() : '?'}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {caption.speaker || 'Unknown'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {caption.text}
                                </p>
                                {caption.timestamp && (
                                  <p className="text-xs text-gray-400">
                                    {new Date(caption.timestamp).toLocaleTimeString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>No transcript available for this meeting.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {tab === 'notes' && (
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Personal Notes</h3>
                  {meeting.notes ? (
                    <div className="mt-4 text-sm text-gray-500 prose max-w-none">
                      <p className="whitespace-pre-line">{meeting.notes}</p>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>No notes available for this meeting.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 