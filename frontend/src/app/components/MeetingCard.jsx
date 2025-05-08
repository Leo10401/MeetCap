'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function MeetingCard({ meeting }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{meeting.title}</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {formatDistanceToNow(new Date(meeting.date), { addSuffix: true })}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
          </p>
          <div className="mt-3">
            <div className="text-sm font-medium text-gray-900">Summary</div>
            <p className={`mt-1 text-sm text-gray-600 ${expanded ? '' : 'line-clamp-3'}`}>
              {meeting.summary || 'No summary available'}
            </p>
            {meeting.summary && meeting.summary.length > 150 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-500"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
        <div className="flex justify-between">
          <div className="flex space-x-3">
            <span className="inline-flex items-center text-xs text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {meeting.rawCaptions ? meeting.rawCaptions.length : 0} captions
            </span>
            {meeting.tags && meeting.tags.length > 0 && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="flex flex-wrap gap-1">
                  {meeting.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tag}
                    </span>
                  ))}
                  {meeting.tags.length > 3 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      +{meeting.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <a
            href={`/meetings/${meeting._id}`}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            View Details
          </a>
        </div>
      </div>
    </div>
  );
} 