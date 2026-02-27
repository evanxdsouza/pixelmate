/**
 * Presentation tools using PPTX generation
 * Browser-compatible implementation
 */

import { Tool, ToolDefinition, ToolResult } from '@pixelmate/shared';
import { HybridFileSystem } from './filesystem.js';

// Simple PPTX-like generation
function generatePresentation(title: string, slides: { title: string; content: string }[]): string {
  const slideXML = slides.map((slide, idx) => `
    <slide id="${idx + 1}">
      <title>${escapeXml(slide.title)}</title>
      <content>${escapeXml(slide.content)}</content>
    </slide>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<presentation>
  <title>${escapeXml(title)}</title>
  <slides>
    ${slideXML}
  </slides>
</presentation>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class CreatePresentationTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_presentation',
    description: 'Create a new presentation',
    parameters: [
      { name: 'title', description: 'Presentation title', type: 'string', required: true },
      { name: 'slides', description: 'Array of slides with title and content', type: 'array', required: true },
      { name: 'filePath', description: 'Path to save presentation', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const slides = params.slides as { title: string; content: string }[];
      const filePath = (params.filePath as string) || `/${title}.pptx`;

      const content = generatePresentation(title, slides);
      await this.fs.writeFile(filePath, content);
      
      return { success: true, output: `Presentation created at ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class CreateSlidesFromOutlineTool implements Tool {
  definition: ToolDefinition = {
    name: 'create_slides_from_outline',
    description: 'Create presentation slides from markdown outline',
    parameters: [
      { name: 'title', description: 'Presentation title', type: 'string', required: true },
      { name: 'outline', description: 'Markdown outline for slides', type: 'string', required: true },
      { name: 'filePath', description: 'Path to save presentation', type: 'string', required: false }
    ]
  };

  constructor(private fs: HybridFileSystem) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const title = params.title as string;
      const outline = params.outline as string;
      const filePath = (params.filePath as string) || `/${title}.pptx`;

      // Parse markdown outline into slides
      const slides = parseOutlineToSlides(outline);
      
      const content = generatePresentation(title, slides);
      await this.fs.writeFile(filePath, content);
      
      return { success: true, output: `Presentation with ${slides.length} slides created at ${filePath}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function parseOutlineToSlides(outline: string): { title: string; content: string }[] {
  const slides: { title: string; content: string }[] = [];
  const lines = outline.split('\n');
  
  let currentSlide: { title: string; content: string[] } | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# ')) {
      // Main slide title
      if (currentSlide) {
        slides.push({ title: currentSlide.title, content: currentSlide.content.join('\n') });
      }
      currentSlide = { title: trimmed.slice(2), content: [] };
    } else if (trimmed.startsWith('## ') && currentSlide) {
      // Subsection
      currentSlide.content.push(trimmed.slice(3));
    } else if (trimmed.startsWith('- ') && currentSlide) {
      // Bullet point
      currentSlide.content.push(`• ${trimmed.slice(2)}`);
    } else if (trimmed && currentSlide) {
      // Regular content
      currentSlide.content.push(trimmed);
    }
  }
  
  if (currentSlide) {
    slides.push({ title: currentSlide.title, content: currentSlide.content.join('\n') });
  }
  
  return slides;
}
