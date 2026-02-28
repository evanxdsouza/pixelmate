# Quick Start Guide

Get PixelMate running and complete your first task in under 5 minutes.

## Prerequisites

- [ ] Chrome or Chromium browser
- [ ] At least one LLM provider API key (Anthropic, OpenAI, or Groq)
- [ ] Node.js 20 + pnpm (only needed if building from source)

---

## Option A — Load Pre-Built Extension

If you have the built extension zip:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `packages/extension-v2/dist` folder
4. Pin the PixelMate icon to the toolbar
5. Click the icon → enter your API key in **Settings**

Skip to [Step 3](#step-3-configure-your-api-key).

---

## Option B — Build from Source

### Step 1: Install and Build

```bash
git clone https://github.com/pixelmate/pixelmate.git
cd pixelmate

# Install all workspace dependencies
pnpm install

# Build everything
pnpm run build
```

The built extension is at `packages/extension-v2/dist/`.

### Step 2: Load the Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension-v2/dist`
4. The PixelMate icon appears in the toolbar

---

## Step 3: Configure Your API Key

1. Click the PixelMate toolbar icon
2. Go to **Settings** (gear icon in the sidebar)
3. Under **AI Provider**, choose your provider (Anthropic, OpenAI, or Groq)
4. Select your preferred **Model** from the dropdown
5. Paste your API key and click **Save Key**

> Your API key is stored in `chrome.storage.sync` — it never leaves your browser.

---

## Step 4: Start Chatting

Click the PixelMate icon → type a message → press **Enter** or click **Send**.

### Example Tasks

```
Create a markdown document summarizing today's news about AI
```

```
Search the web for the latest PyPI releases and write a CSV summary
```

```
List all files in my workspace and organize them into folders
```

---

## Option C — PWA Frontend (Advanced)

For a full-page PWA experience alongside the extension:

```bash
pnpm --filter @pixelmate/frontend dev
```

Open `http://localhost:5173` — it auto-connects to the installed extension via `chrome.runtime`.

---

## Verify Everything Works

- Extension icon is visible and shows **Extension active** (green dot)
- Settings shows your provider and API key saved
- Typing a message in chat returns a response

You should see the PixelMate chat interface:

```
┌─────────────────────────────────────────┐
│  PixelMate                    [⚙️] [📱] │
├─────────────────────────────────────────┤
│                                         │
│  Hello! I'm PixelMate, your AI         │
│  assistant. How can I help you today?  │
│                                         │
├─────────────────────────────────────────┤
│  Type your message...            [Send]│
└─────────────────────────────────────────┘
```

---

## Step 2: Try Basic Tasks

### Task 1: Read a File

Ask PixelMate to read a file:

```
Can you list the files in the current directory?
```

Expected response: Lists files in your workspace directory.

### Task 2: Create a File

```
Create a file called "hello.txt" with the content "Hello from PixelMate!"
```

PixelMate will:
1. Show a confirmation dialog (security feature)
2. Click "Approve" to confirm
3. File gets created

### Task 3: Create a Spreadsheet

```
Create a spreadsheet with monthly expenses data
```

---

## Step 3: Use Skills

Skills are specialized capabilities for common tasks. Try:

### Research Skill
```
Use the Research skill to find information about best practices for remote work
```

### Report Generation
```
Create a report about my recent meeting notes in the workspace
```

### Data Analysis
```
Analyze the sales data in sales.csv and give me a summary
```

---

## Step 4: Browser Automation

### Navigate to a Website
```
Go to https://example.com and tell me what the page is about
```

### Search the Web
```
Search for "latest AI news" and show me the top 5 results
```

---

## Common First Tasks

Here are some recommended first tasks to try:

| Task | Description | Tools Used |
|------|-------------|-------------|
| File Organizer | List and organize files in a folder | list_directory, glob |
| Note Taker | Create meeting notes document | create_document |
| Data Export | Export data to spreadsheet | create_spreadsheet, create_csv |
| Research | Search and compile research | web_search, research_topic |
| Content Transform | Convert transcript to blog | convert_to_document |

---

## Understanding the Interface

### Chat Area
- Messages from PixelMate appear here
- Shows tool calls and results
- Displays confirmation requests

### Input Box
- Type your requests here
- Press Enter or click Send to submit
- Use Shift+Enter for new lines

### Settings (⚙️)
- Configure LLM provider
- Set default model
- Adjust working directory

### Install App (📱)
- Install PixelMate as PWA
- Works offline for chat
- Desktop-like experience

---

## Pro Tips

### 1. Be Specific
```
❌ "Do something with data"
✅ "Create a CSV file with headers: name, email, phone"
```

### 2. Chain Tasks
```
"First read the file report.txt, then create a summary and save it as summary.md"
```

### 3. Use Skills
```
"Use the Report Generation skill to create a quarterly report"
```

### 4. Check Confirmation
- Red items require approval
- Review parameters before confirming
- Deny suspicious requests

---

## Troubleshooting

### "No API Key" Error
- Check your `.env` file has valid keys
- Restart the backend after changing `.env`

### Tool Execution Failed
- Check the error message
- Verify file paths exist
- Ensure proper permissions

### WebSocket Disconnected
- Refresh the page
- Check backend is running
- Check browser console for errors

---

## Next Steps

Now that you've tried PixelMate, explore:

- [Tools Reference](./tools.md) - All available tools
- [Skills](./skills.md) - Specialized capabilities
- [Configuration](./configuration.md) - Customize your setup
- [Chrome Extension](./chrome-extension.md) - Browser integration
