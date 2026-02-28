import { ToolRegistry } from './registry.js';
import type { Tool } from '@pixelmate/shared';

export { ToolRegistry };
export type { Tool };

// Filesystem tools
export { 
  HybridFileSystem, 
  ReadFileTool, 
  WriteFileTool, 
  ListDirectoryTool, 
  CreateDirectoryTool, 
  DeleteFileTool, 
  MoveFileTool, 
  CopyFileTool 
} from './filesystem.js';

// Browser automation tools
export {
  BrowserNavigateTool,
  BrowserClickTool,
  BrowserFillTool,
  BrowserTypeTool,
  BrowserSelectTool,
  BrowserGetTextTool,
  BrowserGetHTMLTool,
  BrowserScreenshotTool,
  BrowserScrollTool,
  BrowserWaitTool
} from './browser.js';

// Document tools
export { CreateDocumentTool, ConvertToDocumentTool } from './document.js';

// Spreadsheet tools
export { CreateSpreadsheetTool, ReadSpreadsheetTool, CreateCSVTool, ReadCSVTool } from './spreadsheet.js';

// Presentation tools
export { CreatePresentationTool, CreateSlidesFromOutlineTool } from './presentation.js';

// Formatter tools
export { FormatAsJSONTool, FormatAsMarkdownTool, ParseJSONTool, ConvertBetweenFormatsTool } from './formatters.js';

// Web search tools
export { WebSearchTool, FetchWebPageTool, ResearchTopicTool } from './web-search.js';

// Google Workspace tools (Docs, Sheets, Slides)
export {
  GoogleDocsCreateTool,
  GoogleDocsReadTool,
  GoogleDocsAppendTool,
  GoogleSheetsCreateTool,
  GoogleSheetsReadTool,
  GoogleSheetsWriteTool,
  GoogleSlidesCreateTool,
  GoogleSlidesReadTool,
} from './google-workspace.js';
export type { GetToken } from './google-workspace.js';

// Gmail tools
export {
  GmailListTool,
  GmailReadTool,
  GmailSearchTool,
  GmailSendTool,
  GmailReplyTool,
} from './gmail.js';
