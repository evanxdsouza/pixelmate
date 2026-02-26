# Tools Reference

Complete reference for all available tools in PixelMate.

---

## File System Tools

Tools for reading, writing, and managing files on your local filesystem.

### read_file

Read the contents of a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to the file (relative to working directory) |

**Example:**
```
Read the file called "notes.txt"
```

**Response:** File contents as string

**Error Conditions:**
- File not found
- Permission denied
- Not a file (directory)

---

### write_file

Write content to a file. Creates the file if it doesn't exist, overwrites if it does.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to the file |
| `content` | string | Yes | Content to write |

**Security:** Requires confirmation (Medium danger)

**Example:**
```
Create a file called "hello.txt" with "Hello World"
```

---

### list_directory

List files and directories in a given directory.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | No | `.` | Directory path |

**Returns:** Array of items with name, type, size, modified date

**Example:**
```
List all files in the documents folder
```

---

### create_directory

Create a new directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path to create |

**Example:**
```
Create a folder called "new_project"
```

---

### delete_file

Delete a file or directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to delete |

**Security:** Requires confirmation (Critical danger)

**Warning:** This action is irreversible!

---

### move_file

Move or rename a file or directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | string | Yes | Source path |
| `destination` | string | Yes | Destination path |

**Security:** Requires confirmation (Critical danger)

---

### copy_file

Copy a file or directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | string | Yes | Source path |
| `destination` | string | Yes | Destination path |

---

### glob

Find files matching a pattern.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `pattern` | string | Yes | - | Glob pattern (e.g., `*.txt`, `**/*.js`) |
| `path` | string | No | `.` | Directory to search |

**Pattern Examples:**
| Pattern | Matches |
|---------|---------|
| `*.txt` | All .txt files |
| `**/*.js` | All .js files recursively |
| `data/*.csv` | CSV files in data folder |
| `**/test*` | Files starting with "test" anywhere |

---

## Spreadsheet Tools

Tools for creating and reading spreadsheet files.

### create_spreadsheet

Create an Excel spreadsheet (.xlsx) file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output file path (e.g., `report.xlsx`) |
| `sheets` | array | Yes | Array of sheet objects |
| `options` | object | No | Optional settings |

**Sheet Object:**
```json
{
  "name": "Sheet1",
  "data": [
    ["Header1", "Header2"],
    ["Value1", "Value2"]
  ]
}
```

**Options:**
| Property | Type | Description |
|----------|------|-------------|
| `freezeRows` | number | Number of rows to freeze |
| `freezeCols` | number | Number of columns to freeze |

**Example:**
```
Create a spreadsheet with monthly sales data
```

---

### read_spreadsheet

Read data from an Excel spreadsheet.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | - | Path to Excel file |
| `sheet` | string | No | - | Sheet name or index |
| `asJson` | boolean | No | true | Return as JSON objects |

---

### create_csv

Create a CSV file from data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output CSV file path |
| `data` | array | Yes | Array of objects or arrays |
| `headers` | array | No | Custom headers |

**Example:**
```
Create a CSV with columns: name, email, phone
```

---

### read_csv

Read a CSV file and return as JSON.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | - | CSV file path |
| `hasHeaders` | boolean | No | true | First row is headers |

---

## Document Tools

Tools for creating Word documents.

### create_document

Create a Microsoft Word document (.docx).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output file path |
| `content` | object | Yes | Document content |

**Content Object:**
```json
{
  "title": "My Document",
  "paragraphs": [
    { "text": "Introduction text" },
    { "heading": "Heading1", "text": "Section Title" }
  ],
  "tables": [
    {
      "headers": ["Name", "Value"],
      "rows": [["A", 1], ["B", 2]]
    }
  ]
}
```

**Example:**
```
Create a document with meeting notes
```

---

### convert_to_document

Convert markdown or text to Word format.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output Word file path |
| `sourcePath` | string | Yes | Source markdown/text file |
| `title` | string | No | Document title |

---

## Presentation Tools

Tools for creating PowerPoint presentations.

### create_presentation

Create a PowerPoint (.pptx) presentation.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output file path |
| `slides` | array | Yes | Array of slide objects |
| `options` | object | No | Presentation options |

**Slide Object:**
```json
{
  "title": "Slide Title",
  "bulletPoints": ["Point 1", "Point 2"],
  "table": {
    "headers": ["Col1", "Col2"],
    "rows": [["A", "B"]]
  }
}
```

**Options:**
```json
{
  "title": "Presentation Title",
  "author": "Author Name",
  "subject": "Subject"
}
```

---

### create_slides_from_outline

Generate slides from a markdown outline file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Output PowerPoint path |
| `sourcePath` | string | Yes | Markdown outline file |
| `options` | object | No | Presentation options |

**Markdown Format:**
```markdown
# Presentation Title

## Slide 1 Title
- Point 1
- Point 2

## Slide 2 Title
- Point A
- Point B
```

---

## Browser Tools

Tools for browser automation using Playwright.

### browser_navigate

Navigate to a URL.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | URL to navigate to |
| `waitUntil` | string | No | Wait strategy (load, domcontentloaded, networkidle) |

**Security:** Requires confirmation (High danger)

---

### browser_click

Click an element on the page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for element |
| `waitFor` | boolean | No | Wait for element to appear |

**Security:** Requires confirmation (Medium danger)

---

### browser_fill

Fill a form input.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Input selector |
| `value` | string | Yes | Value to fill |

**Security:** Requires confirmation (Medium danger)

---

### browser_type

Type text with delays (simulates human typing).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Input selector |
| `text` | string | Yes | Text to type |
| `delay` | number | No | Delay between keystrokes (ms) |

---

### browser_select

Select an option from a dropdown.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Select element selector |
| `value` | string | Yes | Value to select |

---

### browser_get_text

Extract text content from elements.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Element selector |
| `all` | boolean | No | Get all matches |

---

### browser_get_html

Extract HTML from elements.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Element selector |
| `all` | boolean | No | Get all matches |

---

### browser_screenshot

Take a screenshot of the current page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | No | Save path (optional) |

**Returns:** Base64 encoded image

---

### browser_snapshot

Get a snapshot of the page state.

**Returns:** Page URL, title, visible text, interactive elements

---

### browser_scroll

Scroll the page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `direction` | string | No | 'up' or 'down' |
| `pixels` | number | No | Pixels to scroll |

---

### browser_wait

Wait for an element or condition.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Element to wait for |
| `timeout` | number | No | Timeout in ms |

---

### browser_close

Close the current page/browser.

---

## Web Tools

Tools for searching and fetching web content.

### web_search

Search the web using Google.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query |
| `numResults` | number | No | 10 | Number of results |

**Returns:** Array of results with title, URL, snippet

---

### fetch_web_page

Fetch and extract content from a web page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | URL to fetch |
| `selector` | string | No | CSS selector for specific content |

**Returns:** Page text content

---

### research_topic

Search the web and fetch detailed information from top sources.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | Yes | - | Research query |
| `numSources` | number | No | 3 | Number of sources |

**Returns:** Array of sources with title, URL, and content summary

---

## Formatter Tools

Tools for data format conversion.

### format_as_json

Format data as JSON.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | object | Yes | Data to format |
| `path` | string | No | Save path |
| `pretty` | boolean | No | Pretty print |

---

### format_as_markdown

Convert data to markdown format.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | object | Yes | Data object |
| `path` | string | No | Save path |

**Data Types:**
- Table: `{ type: "table", data: { headers, rows } }`
- List: `{ type: "list", data: ["item1", "item2"] }`
- Report: `{ type: "report", title, sections }`
- Key-Value: `{ type: "keyValue", data: { key: "value" } }`

---

### parse_json

Parse JSON string or read JSON file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | string | Yes | JSON string or file path |

---

### convert_format

Convert data between formats.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | string | Yes | Input data or file path |
| `fromFormat` | string | Yes | Source format (csv, json, markdown) |
| `toFormat` | string | Yes | Target format |
| `outputPath` | string | No | Save path |

---

## Danger Levels

| Level | Description | Confirmation Required |
|-------|-------------|----------------------|
| `none` | Safe operations | No |
| `low` | Minor side effects | No |
| `medium` | Modifies data | Yes |
| `high` | Significant changes | Yes |
| `critical` | Destructive actions | Yes |

---

## Next Steps

- [Skills](./skills.md) - Specialized capabilities
- [Security](./security.md) - Security configuration
- [API Reference](./api.md) - Developer API
