// eslint-disable-next-line no-unused-vars
import 'isomorphic-fetch';
import './styles/globals.css';
import '@testing-library/jest-dom';
import { enableFetchMocks } from 'jest-fetch-mock';

if (typeof global.TextEncoder === 'undefined') {
   const { TextEncoder, TextDecoder } = require('util');
   global.TextEncoder = TextEncoder;
   global.TextDecoder = TextDecoder;
}

if (typeof global.BroadcastChannel === 'undefined') {
   const { BroadcastChannel } = require('worker_threads');
   global.BroadcastChannel = BroadcastChannel;
}

if (typeof global.WritableStream === 'undefined') {
   const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
   global.ReadableStream = ReadableStream;
   global.WritableStream = WritableStream;
   global.TransformStream = TransformStream;
}
// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom

window.matchMedia = (query) => ({
   matches: false,
   media: query,
   onchange: null,
   addListener: jest.fn(), // deprecated
   removeListener: jest.fn(), // deprecated
   addEventListener: jest.fn(),
   removeEventListener: jest.fn(),
   dispatchEvent: jest.fn(),
});

global.ResizeObserver = require('resize-observer-polyfill');

// Enable Fetch Mocking
enableFetchMocks();
