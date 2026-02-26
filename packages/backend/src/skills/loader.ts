import fs from 'fs/promises';
import path from 'path';

export interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
  examples: string[];
  parameters: SkillParameter[];
  tools?: string[];
}

export interface SkillParameter {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface LoadedSkill {
  definition: SkillDefinition;
  filePath: string;
}

export class SkillLoader {
  private skillsDir: string;
  private skills: Map<string, LoadedSkill> = new Map();

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  async loadAll(): Promise<void> {
    try {
      await fs.mkdir(this.skillsDir, { recursive: true });
      const files = await fs.readdir(this.skillsDir);
      
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.skill.md')) {
          const filePath = path.join(this.skillsDir, file);
          await this.loadSkill(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  }

  async loadSkill(filePath: string): Promise<LoadedSkill | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const definition = this.parseSkillFile(content, filePath);
      
      const skill: LoadedSkill = {
        definition,
        filePath
      };
      
      this.skills.set(definition.name, skill);
      return skill;
    } catch (error) {
      console.error(`Failed to load skill from ${filePath}:`, error);
      return null;
    }
  }

  private parseSkillFile(content: string, filePath: string): SkillDefinition {
    const lines = content.split('\n');
    let name = path.basename(filePath, path.extname(filePath));
    let description = '';
    const instructions: string[] = [];
    const examples: string[] = [];
    const parameters: SkillParameter[] = [];
    let inInstructions = false;
    let inExamples = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        name = line.slice(2).trim();
      } else if (line.startsWith('## Description')) {
        // Skip header
      } else if (line.startsWith('## Instructions')) {
        inInstructions = true;
        inExamples = false;
      } else if (line.startsWith('## Examples')) {
        inInstructions = false;
        inExamples = true;
      } else if (line.startsWith('## Parameters')) {
        inInstructions = false;
        inExamples = false;
      } else if (line.match(/^- \w+:/)) {
        // Parameter definition
        const match = line.match(/^- (\w+):\s*(.+)/);
        if (match) {
          parameters.push({
            name: match[1],
            description: match[2],
            required: !line.includes('(optional)')
          });
        }
      } else if (inInstructions && line.trim()) {
        instructions.push(line.trim());
      } else if (inExamples && line.trim()) {
        examples.push(line.trim());
      } else if (!inInstructions && !inExamples && line.trim() && !line.startsWith('#')) {
        description += line.trim() + ' ';
      }
    }

    return {
      name,
      description: description.trim(),
      instructions: instructions.join('\n'),
      examples,
      parameters
    };
  }

  get(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  getAll(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  list(): SkillDefinition[] {
    return this.getAll().map(s => s.definition);
  }

  toPrompt(): string {
    const skills = this.list();
    if (skills.length === 0) {
      return 'No skills available.';
    }

    let prompt = '## Available Skills\n\n';
    for (const skill of skills) {
      prompt += `### ${skill.name}\n`;
      prompt += `${skill.description}\n\n`;
      if (skill.examples.length > 0) {
        prompt += 'Examples:\n';
        for (const example of skill.examples) {
          prompt += `- ${example}\n`;
        }
        prompt += '\n';
      }
    }

    return prompt;
  }
}
