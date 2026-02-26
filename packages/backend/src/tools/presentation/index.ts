import { Tool, ToolResult, ToolParameter } from '../types.js';
import PptxGenJS from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';
import { PathSandbox } from '../filesystem/sandbox.js';

type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

function param(name: string, description: string, type: ParamType, required: boolean, defaultValue?: unknown): ToolParameter {
  return { name, description, type, required, default: defaultValue };
}

interface SlideContent {
  title: string;
  content?: string[];
  bulletPoints?: string[];
  table?: { headers: string[]; rows: (string | number)[][] };
  twoColumns?: { left: string[]; right: string[] };
  image?: string;
  notes?: string;
}

interface PresentationOptions {
  title?: string;
  author?: string;
  subject?: string;
  theme?: string;
}

export class CreatePresentationTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_presentation',
    description: 'Create a PowerPoint presentation (.pptx) with slides containing text, bullet points, tables, and images',
    parameters: [
      param('path', 'The path for the output PowerPoint file (relative to working directory, e.g., "presentation.pptx")', 'string', true),
      param('slides', 'Array of slide objects: [{ title, content[], bulletPoints[], table{headers,rows}, twoColumns{left,right}, image, notes }]', 'array', true),
      param('options', 'Optional: { title, author, subject, theme }', 'object', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const slides = params.slides as SlideContent[];
      const options = (params.options as PresentationOptions) || {};

      const pres = new PptxGenJS();
      
      pres.author = options.author || 'PixelMate';
      pres.subject = options.subject || '';
      pres.title = options.title || 'Presentation';

      for (const slideData of slides) {
        const slide = pres.addSlide();
        
        if (slideData.title) {
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.3,
            w: '90%',
            h: 0.8,
            fontSize: 32,
            bold: true,
            color: '363636',
          });
        }

        let yPos = 1.5;

        if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
          slide.addText(slideData.bulletPoints.map(bp => ({ text: bp, options: { bullet: { type: 'bullet' } } })), {
            x: 0.5,
            y: yPos,
            w: '90%',
            h: 4,
            fontSize: 18,
            color: '363636',
            lineSpacing: 35,
          });
        } else if (slideData.content && slideData.content.length > 0) {
          slide.addText(slideData.content.join('\n\n'), {
            x: 0.5,
            y: yPos,
            w: '90%',
            h: 4,
            fontSize: 18,
            color: '363636',
          });
        }

        if (slideData.table) {
          const tableData = [
            slideData.table.headers.map(h => ({ text: String(h), options: { bold: true, fill: 'E0E0E0' } })),
            ...slideData.table.rows.map(row => row.map(cell => ({ text: String(cell) })))
          ];
          
          slide.addTable(tableData, {
            x: 0.5,
            y: yPos + 3,
            w: '90%',
            fontSize: 14,
            color: '363636',
          });
        }

        if (slideData.twoColumns) {
          slide.addText(slideData.twoColumns.left.join('\n\n'), {
            x: 0.5,
            y: yPos,
            w: '45%',
            h: 4,
            fontSize: 16,
            color: '363636',
          });
          
          slide.addText(slideData.twoColumns.right.join('\n\n'), {
            x: 5,
            y: yPos,
            w: '45%',
            h: 4,
            fontSize: 16,
            color: '363636',
          });
        }

        if (slideData.image) {
          const imagePath = this.sandbox.resolve(slideData.image);
          slide.addImage({ path: imagePath, x: 2, y: 2, w: 6, h: 4 });
        }

        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      }

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await pres.writeFile({ fileName: filePath });

      return { success: true, output: `Presentation created: ${params.path} with ${slides.length} slides` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class CreateSlidesFromOutlineTool implements Tool {
  private sandbox: PathSandbox;

  constructor(workingDirectory: string) {
    this.sandbox = new PathSandbox(workingDirectory);
  }

  definition = {
    name: 'create_slides_from_outline',
    description: 'Create a PowerPoint presentation from a markdown outline file',
    parameters: [
      param('path', 'The path for the output PowerPoint file', 'string', true),
      param('sourcePath', 'Path to the markdown file containing slide outline', 'string', true),
      param('options', 'Optional: { title, author, subject }', 'object', false)
    ]
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = this.sandbox.resolve(params.path as string);
      const sourcePath = this.sandbox.resolve(params.sourcePath as string);
      const options = (params.options as PresentationOptions) || {};

      const content = await fs.readFile(sourcePath, 'utf-8');
      const lines = content.split('\n');

      const pres = new PptxGenJS();
      
      pres.author = options.author || 'PixelMate';
      pres.subject = options.subject || '';
      pres.title = options.title || 'Presentation';

      let currentTitle = '';
      let currentPoints: string[] = [];
      let isTitleSlide = true;

      const addCurrentSlide = () => {
        if (!currentTitle && currentPoints.length === 0) return;

        const slide = pres.addSlide();
        
        if (isTitleSlide) {
          slide.addText(currentTitle, {
            x: 0.5,
            y: 2,
            w: '90%',
            h: 1.5,
            fontSize: 44,
            bold: true,
            color: '363636',
            align: 'center',
          });
          isTitleSlide = false;
        } else {
          slide.addText(currentTitle, {
            x: 0.5,
            y: 0.3,
            w: '90%',
            h: 0.8,
            fontSize: 32,
            bold: true,
            color: '363636',
          });

          if (currentPoints.length > 0) {
            slide.addText(currentPoints.map(bp => ({ text: bp, options: { bullet: { type: 'bullet' } } })), {
              x: 0.5,
              y: 1.5,
              w: '90%',
              h: 4,
              fontSize: 20,
              color: '363636',
              lineSpacing: 40,
            });
          }
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('# ')) {
          addCurrentSlide();
          currentTitle = trimmed.slice(2);
          currentPoints = [];
        } else if (trimmed.startsWith('## ')) {
          addCurrentSlide();
          currentTitle = trimmed.slice(3);
          currentPoints = [];
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          currentPoints.push(trimmed.slice(2));
        } else if (trimmed && !trimmed.startsWith('#')) {
          if (currentPoints.length === 0) {
            currentTitle = trimmed;
          } else {
            currentPoints[currentPoints.length - 1] += ' ' + trimmed;
          }
        }
      }

      addCurrentSlide();

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await pres.writeFile({ fileName: filePath });

      return { success: true, output: `Presentation created from outline: ${params.path}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
