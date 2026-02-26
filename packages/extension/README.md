# PixelMate Chrome Extension

Quickly send tasks to your PixelMate AI agent from any Chrome tab.

## Installation

1. Build the project: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `packages/extension` folder

## Usage

1. Make sure PixelMate backend is running (`npm run dev:backend`)
2. Click the PixelMate extension icon in Chrome
3. Enter a task or use quick actions on the current page

## Features

- Send tasks to PixelMate from any tab
- Quick actions on current page (get title, click elements, etc.)
- Real-time status updates
- WebSocket + HTTP fallback

## Requirements

- PixelMate backend running on port 3001
