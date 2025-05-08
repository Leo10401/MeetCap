'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import MeetingCard from '../components/MeetingCard';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const router = useRouter();
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  
  // Function to fetch meetings from the API
  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/meetings', {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }
      
      const data = await response.json();
      setMeetings(data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setError('Failed to load your meetings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load meetings when component mounts
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
    
    if (token) {
      fetchMeetings();
    }
  }, [token, authLoading, isAuthenticated, router]);
  
  // Filter meetings based on search term and tag
  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = searchTerm === '' || 
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesTag = filterTag === '' || 
      (meeting.tags && meeting.tags.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase())));
      
    return matchesSearch && matchesTag;
  });
  
  // Get all unique tags for filter dropdown
  const allTags = [...new Set(meetings.flatMap(meeting => meeting.tags || []))];
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-grow py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Meeting History</h1>
              <p className="mt-1 text-sm text-gray-500">
                Browse and search through your saved Google Meet sessions
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <a
                href="/meetings/extension"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Download Extension
              </a>
            </div>
          </div>
          
          <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex-1">
                  <label htmlFor="search" className="sr-only">Search meetings</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="search"
                      id="search"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="Search by title or content"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                {allTags.length > 0 && (
                  <div className="w-full md:w-64">
                    <label htmlFor="tag-filter" className="sr-only">Filter by tag</label>
                    <select
                      id="tag-filter"
                      name="tag-filter"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      value={filterTag}
                      onChange={e => setFilterTag(e.target.value)}
                    >
                      <option value="">All Tags</option>
                      {allTags.map((tag, index) => (
                        <option key={index} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">Loading your meetings...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <svg className="h-12 w-12 text-red-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="mt-2 text-sm text-red-500">{error}</p>
              <button
                onClick={fetchMeetings}
                className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Try Again
              </button>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center py-12 bg-white shadow-sm rounded-lg mt-6">
              {meetings.length === 0 ? (
                <>
                  <svg className="h-12 w-12 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Install the CapMeet extension and start recording your Google Meet sessions.
                  </p>
                </>
              ) : (
                <>
                  <svg className="h-12 w-12 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No matching meetings</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or filter to find what you're looking for.
                  </p>
                  <button
                    onClick={() => { setSearchTerm(''); setFilterTag(''); }}
                    className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {filteredMeetings.map(meeting => (
                <MeetingCard key={meeting._id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 