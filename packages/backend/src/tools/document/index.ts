import { Tool, ToolResult, ToolParameter } from '../types.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
import fs from 'fs/promises';
import path from 'path';
import { PathSandbox } from '../filesystem/sandbox.js';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

interface ParagraphBlock {
  text?: string;
  items?: string[];
  bold?: boolean;
  alignment?: string;
  heading?: string;
}

interface TableBlock {
  headers: string[];
  rows: (string | number)[][];
}

interface DocumentContent {
  title?: string;
  paragraphs?: ParagraphBlock[];
  tables?: TableBlock[];
}

function getHeadingLevel(value?: string) {
  if (!value) return undefined;
  const levels: Record<string, string> = {
    'Heading1': 'Heading1',
    'Heading2': 'Heading2',
    'Heading3': 'Heading3',
    'Heading4': 'Heading4',
    'Heading5': 'Heading5',
    'Heading6': 'Heading6',
    'Title': 'Title',
  };
  return levels[value] as any;
}

function getAlignment(value?: string) {
  if (!value) return undefined;
  const alignments: Record<string, string> = {
    'start': 'start',
    'center': 'center',
    'end': 'end',
    'left': 'left',
    'right': 'right',
    'both': 'both',
  };
  return alignments[value] as any;
}

function createParagraph(block: ParagraphBlock): Paragraph {
  const children: TextRun[] = [];

  if (block.text) {
    children.push(new TextRun({
      text: block.text,
      bold: block.bold,
    }));
  }

  if (block.items) {
    block.items.forEach((item, idx) => {
      if (idx > 0) children.push(new TextRun({ text: ' ' }));
      children.push(new TextRun({ text: item, bold: block.bold }));
    });
  }

  return new Paragraph({
    children,
    alignment: getAlignment(block.alignment),
    heading: getHeadingLevel(block.heading),
    spacing: { after: 200 },
  });
}

function createTableBlock(block: TableBlock): Table {
  const headerCells = block.headers.map(h => 
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
      shading: { fill: 'E0E0E0' },
    })
  );

  const headerRow = new TableRow({ children: headerCells });

  const dataRows = block.rows.map(row =>
    new TableCell({
      children: row.map(cell => new Paragraph({ 
        children: [new TextRun({ text: String(cell) })] 
      })),
    })
  );

  return new Table({
    rows: [headerRow, ...dataRows.map(c => new TableRow({ children: [c] }))],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

export class CreateDocumentTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_document',
    description: 'Create a Microsoft Word document (.docx) with text, headings, lists, and tables',
    parameters: [
      param('path', 'The path for the output Word document (relative to working directory, e.g., "report.docx")', 'string', true),
      param('content', 'Document content object: { title: string, paragraphs: [{text/items, bold, heading, alignment}], tables: [{headers, rows}] }', 'object', true)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const content = params.content as DocumentContent;

      const children: (Paragraph | Table)[] = [];

      if (content.title) {
        children.push(new Paragraph({
          children: [new TextRun({ text: content.title, bold: true, size: 44 })],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }));
      }

      if (content.paragraphs) {
        for (const block of content.paragraphs) {
          if (block.heading) {
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text || '', bold: true })],
              heading: getHeadingLevel(block.heading),
              spacing: { before: 400, after: 200 },
            }));
          } else {
            children.push(createParagraph(block));
          }
        }
      }

      if (content.tables) {
        for (const tableBlock of content.tables) {
          children.push(createTableBlock(tableBlock));
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filePath, buffer);

      return { success: true, output: `Document created: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class ConvertToDocumentTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'convert_to_document',
    description: 'Convert markdown or plain text to a Word document',
    parameters: [
      param('path', 'The path for the output Word document', 'string', true),
      param('sourcePath', 'Path to the markdown or text file to convert', 'string', true),
      param('title', 'Optional title for the document', 'string', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const sourcePath = this.sandbox.resolve(params.sourcePath as string);
      const title = params.title as string | undefined;

      const content = await fs.readFile(sourcePath, 'utf-8');
      const lines = content.split('\n');
      
      const children: (Paragraph | Table)[] = [];

      if (title) {
        children.push(new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 44 })],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }));
      }

      let currentParagraph: string[] = [];
      let currentHeading: string | undefined;

      const flushParagraph = () => {
        if (currentParagraph.length === 0) return;
        
        const text = currentParagraph.join(' ');
        
        if (currentHeading) {
          children.push(new Paragraph({
            children: [new TextRun({ text, bold: true })],
            heading: getHeadingLevel(currentHeading),
            spacing: { before: 400, after: 200 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text })],
            spacing: { after: 200 },
          }));
        }
        
        currentParagraph = [];
        currentHeading = undefined;
      };

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('# ')) {
          flushParagraph();
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 44 })],
            heading: HeadingLevel.TITLE,
            spacing: { before: 400, after: 200 },
          }));
        } else if (trimmed.startsWith('## ')) {
          flushParagraph();
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(3), bold: true, size: 36 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }));
        } else if (trimmed.startsWith('### ')) {
          flushParagraph();
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }));
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          flushParagraph();
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '• ' }),
              new TextRun({ text: trimmed.slice(2) }),
            ],
            indent: { left: 720 },
            spacing: { after: 100 },
          }));
        } else if (trimmed === '') {
          flushParagraph();
        } else {
          currentParagraph.push(trimmed);
        }
      }

      flushParagraph();

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filePath, buffer);

      return { success: true, output: `Document created from ${params.sourcePath}: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
