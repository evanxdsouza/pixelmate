import { z } from 'zod';
import { ProviderType } from '../providers/types.js';

const envSchema = z.object({
  PORT: z.string().optional().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  
  // Provider API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  
  // Default provider
  DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'groq', 'google', 'ollama'])
    .optional()
    .default('anthropic'),
  
  // Working directory for file operations
  WORKING_DIR: z.string().optional().default('./workspace'),
  
  // Agent settings
  MAX_TURNS: z.string().optional().default('50'),
  TOOL_TIMEOUT: z.string().optional().default('30000'),
  
  // Browser settings
  BROWSER_HEADLESS: z.string().optional().default('true'),
  BROWSER_TIMEOUT: z.string().optional().default('30000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

class Config {
  private config: EnvConfig;
  private static instance: Config;

  private constructor() {
    // Load .env file if exists
    try {
      import('dotenv').then(dotenv => {
        dotenv.config();
      });
    } catch {
      // dotenv not available, use env directly
    }

    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment configuration:', result.error.format());
      throw new Error('Environment configuration error');
    }
    this.config = result.data;
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  getAll(): EnvConfig {
    return { ...this.config };
  }

  getProviderApiKey(provider: ProviderType): string | undefined {
    switch (provider) {
      case 'openai':
        return this.config.OPENAI_API_KEY;
      case 'anthropic':
        return this.config.ANTHROPIC_API_KEY;
      case 'groq':
        return this.config.GROQ_API_KEY;
      case 'google':
        return this.config.GOOGLE_API_KEY;
      case 'ollama':
        return undefined;
    }
  }

  getDefaultProvider(): ProviderType {
    return this.config.DEFAULT_PROVIDER;
  }

  getWorkingDir(): string {
    return this.config.WORKING_DIR;
  }

  getMaxTurns(): number {
    return parseInt(this.config.MAX_TURNS, 10);
  }

  getToolTimeout(): number {
    return parseInt(this.config.TOOL_TIMEOUT, 10);
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }
}

export const config = Config.getInstance();
