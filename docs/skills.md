# Skills Reference

Skills are specialized capabilities that help PixelMate handle common tasks more effectively.

---

## Overview

Skills provide structured prompts and guidelines for specific task types. When you activate a skill, PixelMate understands the context and produces more relevant outputs.

### Using Skills

You can activate skills in two ways:

1. **Direct Request:**
   ```
   Use the Research skill to find information about X
   ```

2. **Implicit Activation:**
   ```
   Find information about X
   ```

---

## Built-in Skills

---

## Spreadsheet

Create and manage spreadsheet files with data.

**Description:** This skill helps create Excel-compatible CSV files with formatted data, headers, and basic formulas.

**Instructions:**
- Use CSV format with proper delimiters
- Include headers in the first row
- Use proper data types (numbers, dates, text)
- Keep data organized in tables

**Examples:**
- Create a spreadsheet with monthly sales data
- Make a budget spreadsheet with categories and totals
- Generate a CSV report of user data

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `filename` | Yes | Name of the file to create |
| `headers` | Yes | Column headers |
| `rows` | Yes | Data rows as arrays |

---

## Document

Create and format documents.

**Description:** This skill creates professional Word documents with proper formatting, structure, and styling.

**Instructions:**
- Follow document conventions
- Use proper heading hierarchy
- Include executive summaries when appropriate
- Format tables and lists correctly

**Examples:**
- Create a meeting notes document
- Generate a proposal document
- Make a formal letter

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `title` | Yes | Document title |
| `content` | Yes | Document content structure |

---

## Presentation

Create PowerPoint presentations.

**Description:** This skill generates professional slide decks with proper layout, design, and content structure.

**Instructions:**
- Keep slides concise
- Use bullet points for key information
- Include visual aids when helpful
- Structure content logically

**Examples:**
- Create a presentation for quarterly review
- Generate slides for a product launch
- Make an educational presentation

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `title` | Yes | Presentation title |
| `slides` | Yes | Slide content array |

---

## Email

Draft and format emails.

**Description:** This skill helps compose professional emails for various purposes.

**Instructions:**
- Use appropriate tone
- Include clear subject lines
- Structure content for readability
- Add signatures when appropriate

**Examples:**
- Draft a follow-up email
- Create a meeting request
- Write a customer response

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `to` | Yes | Recipient |
| `subject` | Yes | Email subject |
| `body` | Yes | Email content |
| `cc` | No | CC recipients |

---

## Research

Conduct web research and compile findings into structured reports.

**Description:** This skill helps users research topics by searching the web, fetching relevant pages, and compiling findings into organized documents.

**Instructions:**
1. Use web_search to find relevant sources
2. Use research_topic for detailed information
3. Use fetch_web_page for specific URLs
4. Compile findings into structured formats
5. Save results to appropriate file formats

**For Academic Research:**
- Include source URLs and dates
- Note methodology and key findings
- Identify research gaps

**Examples:**
- Research best practices for remote team management
- Find recent articles about AI in healthcare
- Compile a list of top 10 productivity tools with pricing

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `topic` | Yes | Research topic or question |
| `sources` | No | Number of sources (default: 5) |
| `format` | No | Output format (markdown, csv, spreadsheet) |

---

## Data Analysis

Analyze data from files and generate insights.

**Description:** This skill helps analyze data from various file formats and generate insights, summaries, and visualizations.

**Instructions:**
1. Read data from the appropriate source
2. Identify patterns, trends, and key metrics
3. Calculate aggregations (sums, averages, counts)
4. Generate summary tables and reports
5. Output results in appropriate format

**Examples:**
- Analyze this CSV file and find the top 5 values
- Calculate the average sales per month
- Generate a summary report of the data

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `source` | Yes | Path to the data file |
| `analysis` | Yes | Type of analysis (summary, sort, filter, aggregate) |
| `output` | No | Desired output format |

---

## Report Generation

Create structured reports from various data sources.

**Description:** This skill helps generate professional reports in multiple formats.

**Instructions:**
1. Gather relevant data from files or user input
2. Structure the report with clear sections
3. Use appropriate formatting
4. Export to the requested format

**For Business Reports:**
- Start with an executive summary
- Include data visualizations as tables
- End with actionable recommendations

**For Meeting Reports:**
- List attendees and date
- Summarize discussion points
- Document action items with owners

**Examples:**
- Generate a weekly meeting summary report
- Create a quarterly business review document
- Make a report from these research notes

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `title` | Yes | Report title |
| `sections` | Yes | Report sections and content |
| `format` | Yes | Output format (document, markdown, csv) |
| `audience` | No | Target audience |

---

## Content Transformation

Convert content between different formats and platforms.

**Description:** This skill transforms content between formats and adapts it for different platforms.

**Instructions:**
1. Read the source content
2. Understand the structure and key points
3. Transform to target format
4. Optimize for the target platform

**For Transcript to Blog Posts:**
- Add engaging introduction
- Use proper heading hierarchy
- Break into readable paragraphs

**For Content Repurposing:**
- Extract key points
- Adapt tone for new platform
- Maintain core message

**Examples:**
- Convert this video transcript into a blog post
- Turn this report into a presentation
- Create social media posts from this article

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `source` | Yes | Source file path or content |
| `sourceFormat` | Yes | Original format |
| `targetFormat` | Yes | Desired output format |
| `platform` | No | Target platform |
| `options` | No | Additional options |

---

## Meeting Assistant

Summarize meetings, extract action items, and generate follow-ups.

**Description:** This skill helps manage meeting content by summarizing discussions, identifying action items, and generating follow-ups.

**Instructions:**
1. Read meeting notes or transcript
2. Extract key discussion points
3. Identify decisions made
4. List action items with owners
5. Generate summary and follow-up

**For Meeting Summaries:**
- Date, attendees, and duration
- Main topics discussed
- Decisions made
- Action items with owners

**Examples:**
- Summarize this week's meeting notes
- What action items were assigned?
- Generate follow-up emails for today's meeting

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `source` | Yes | Meeting notes or transcript |
| `type` | Yes | Type of output (summary, action_items, follow_up_email) |
| `attendees` | No | Meeting participants |
| `date` | No | Meeting date |

---

## Competitive Analysis

Compare products, services, or companies side-by-side.

**Description:** This skill helps analyze competitors by creating comparison matrices and strategic assessments.

**Instructions:**
1. Research each competitor
2. Create structured comparison tables
3. Identify gaps and opportunities
4. Generate actionable insights

**For Comparison Matrices:**
- List competitors in columns
- Use consistent evaluation criteria
- Include ratings where applicable

**Examples:**
- Compare Slack vs Teams vs Discord
- Create a competitive analysis of CRM tools
- What are the pros and cons?

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `competitors` | Yes | List of competitors to compare |
| `criteria` | Yes | Comparison criteria |
| `format` | Yes | Output format |
| `includePricing` | No | Include pricing (default: true) |

---

## Project Management

Organize tasks, track progress, and manage project documentation.

**Description:** This skill helps manage projects by organizing tasks, creating plans, and generating status reports.

**Instructions:**
1. List all tasks and their status
2. Organize into phases or milestones
3. Identify dependencies
4. Track progress and blockers
5. Generate status reports

**For Task Management:**
- Create clear, actionable tasks
- Assign owners and deadlines
- Track status (todo, in_progress, done)

**Examples:**
- Create a project plan for building a website
- What's the status of our current tasks?
- Generate a weekly project status report

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `project` | Yes | Project name or description |
| `tasks` | No | List of tasks |
| `output` | Yes | Output format |
| `includeTimeline` | No | Include timeline (default: false) |

---

## Code Assistant

Help with code-related tasks, code review, and documentation.

**Description:** This skill assists with programming tasks including code generation, review, and documentation.

**Instructions:**
1. Read existing code files
2. Generate or modify code
3. Explain functionality clearly
4. Add comments and documentation
5. Follow best practices

**For Code Generation:**
- Use appropriate conventions
- Include error handling
- Add comments for complex logic

**For Code Review:**
- Identify bugs and issues
- Suggest improvements
- Note security concerns

**Examples:**
- Write a function to parse this CSV
- Review this code and suggest improvements
- Add documentation to this script

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| `task` | Yes | Task type (generate, review, explain, document) |
| `language` | Yes | Programming language |
| `source` | No | Source file path |
| `requirements` | No | Specific requirements |

---

## Creating Custom Skills

You can create custom skills by adding markdown files to `packages/backend/src/skills/builtin/`.

### Skill File Format

```markdown
# SkillName

Brief description of the skill.

## Description

Detailed description of what this skill does.

## Instructions

Step-by-step instructions for the agent:
1. First step
2. Second step
3. Third step

## Examples

- Example usage 1
- Example usage 2
- Example usage 3

## Parameters

- param1: Description (required)
- param2: Description (optional)
```

### Example Custom Skill

```markdown
# Image Processing

Process and analyze images.

## Description

This skill helps process images using various techniques.

## Instructions

1. Read the image file
2. Analyze the image content
3. Apply requested transformations
4. Save the output

## Examples

- Resize this image to 800x600
- Convert to black and white
- Add watermark

## Parameters

- input: Input image path (required)
- operation: Operation to perform (required)
- output: Output path (required)
```

---

## Next Steps

- [Tools Reference](./tools.md) - All available tools
- [API Reference](./api.md) - Developer API
- [Security](./security.md) - Security configuration
