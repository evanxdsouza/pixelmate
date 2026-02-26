# Quick Start Guide

Get PixelMate running and complete your first task in under 5 minutes.

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] At least one LLM API key configured
- [ ] Backend server running on port 3001
- [ ] Frontend accessible at http://localhost:3000

---

## Step 1: Launch PixelMate

1. Open your terminal and start the backend:
   ```bash
   npm run dev:backend
   ```

2. In a new terminal, start the frontend:
   ```bash
   npm run dev:frontend
   ```

3. Open http://localhost:3000 in your browser

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
