import { describe, it, expect } from 'vitest';
import {
  getSkillPrompt,
  listSkills,
  SKILLS,
  SKILL_DOCUMENT,
  SKILL_EMAIL,
  SKILL_PRESENTATION,
  SKILL_SPREADSHEET,
  SKILL_RESEARCH,
  SKILL_CODE,
} from './index.js';

describe('Skills system', () => {
  describe('listSkills()', () => {
    it('returns all 6 built-in skill names', () => {
      const skills = listSkills();
      expect(skills).toHaveLength(6);
      expect(skills).toContain('document');
      expect(skills).toContain('email');
      expect(skills).toContain('presentation');
      expect(skills).toContain('spreadsheet');
      expect(skills).toContain('research');
      expect(skills).toContain('code');
    });
  });

  describe('getSkillPrompt()', () => {
    it('returns the document skill prompt', () => {
      const prompt = getSkillPrompt('document');
      expect(prompt).toBe(SKILL_DOCUMENT);
      expect(prompt).toContain('Document Skill');
      expect(prompt).toContain('write_file');
    });

    it('returns the email skill prompt', () => {
      const prompt = getSkillPrompt('email');
      expect(prompt).toBe(SKILL_EMAIL);
      expect(prompt).toContain('Email Skill');
      expect(prompt).toContain('subject line');
    });

    it('returns the presentation skill prompt', () => {
      const prompt = getSkillPrompt('presentation');
      expect(prompt).toBe(SKILL_PRESENTATION);
      expect(prompt).toContain('Presentation Skill');
      expect(prompt).toContain('create_presentation');
    });

    it('returns the spreadsheet skill prompt', () => {
      const prompt = getSkillPrompt('spreadsheet');
      expect(prompt).toBe(SKILL_SPREADSHEET);
      expect(prompt).toContain('Spreadsheet Skill');
      expect(prompt).toContain('create_spreadsheet');
    });

    it('returns the research skill prompt', () => {
      const prompt = getSkillPrompt('research');
      expect(prompt).toBe(SKILL_RESEARCH);
      expect(prompt).toContain('Research Skill');
      expect(prompt).toContain('web_search');
    });

    it('returns the code skill prompt', () => {
      const prompt = getSkillPrompt('code');
      expect(prompt).toBe(SKILL_CODE);
      expect(prompt).toContain('Code Assistant');
    });

    it('is case-insensitive', () => {
      expect(getSkillPrompt('DOCUMENT')).toBe(SKILL_DOCUMENT);
      expect(getSkillPrompt('Email')).toBe(SKILL_EMAIL);
    });

    it('returns a fallback prompt for unknown skills', () => {
      const fallback = getSkillPrompt('unknown-xyz');
      expect(fallback).toBe('You are a helpful AI assistant.');
    });

    it('all skills have non-empty prompts', () => {
      for (const name of listSkills()) {
        const prompt = getSkillPrompt(name);
        expect(prompt.length).toBeGreaterThan(50);
      }
    });
  });

  describe('SKILLS map', () => {
    it('has the correct number of entries', () => {
      expect(Object.keys(SKILLS)).toHaveLength(6);
    });

    it('all values are strings', () => {
      for (const value of Object.values(SKILLS)) {
        expect(typeof value).toBe('string');
      }
    });
  });
});
