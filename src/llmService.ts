import { CONFIG_STORE } from './config_store';
import { OLLAMA_API_URL_DEFAULT, OLLAMA_MODEL_DEFAULT, SUMMARY_PROMPT } from './lib/constants';
import { Ollama } from 'ollama';

// Base class for LLM services
abstract class BaseLLMService implements LLMService {
    // TODO: Now not sure if we need this base class?
    abstract createSummary(content: string, url?: string): Promise<string>;
    abstract listKeywords(content: string): Promise<string[]>;
    abstract createEmbeddings(content: string): Promise<number[]>;
    
    // Common method to get the summary prompt
    protected getSummaryPrompt(content: string): string {
        return `${SUMMARY_PROMPT}${content}`;
    }
}

export interface LLMService {
    createSummary(content: string): Promise<string>;
    listKeywords(content: string): Promise<string[]>;
    createEmbeddings(content: string): Promise<number[]>;
}

export class OpenAILLMService extends BaseLLMService {
    async createSummary(content: string, url?: string): Promise<string> {
        const startTime = performance.now();

        const apiKey = await CONFIG_STORE.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.error('OpenAI API key not set.');
            throw new Error('OpenAI API key not set.');
        }

        const response = await fetch('https://api.openai.com/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'text-davinci-003',
                prompt: this.getSummaryPrompt(content),
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            console.error('LLM API Error:', response.statusText);
            throw new Error('Failed to generate summary.');
        }

        const data = await response.json();
        const summary = data.choices[0].text.trim();

        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log('OpenAI Summary Generated:', summary);
        console.log('OpenAI Summary Generation Time:', duration.toFixed(2), 'ms');


        return summary;
    }

    async listKeywords(_content: string): Promise<string[]> {
        // Implement keyword extraction logic using OpenAI or replace with actual implementation
        // Placeholder implementation
        return ['keyword1', 'keyword2', 'keyword3'];
    }

    async createEmbeddings(_content: string): Promise<number[]> {
        // Implement embeddings creation logic using OpenAI or replace with actual implementation
        // Placeholder implementation
        return [0.1, 0.2, 0.3];
    }
}

export class OllamaLLMService extends BaseLLMService {
    private model: string;
    private client: Ollama;

    constructor(baseUrl: string = OLLAMA_API_URL_DEFAULT, model: string = OLLAMA_MODEL_DEFAULT) {
        super(); // Call the parent class constructor

        this.model = model;

        // Create a custom Ollama client instance with the specified base URL
        this.client = new Ollama({
            host: baseUrl
        });
    }

    async createSummary(content: string, url?: string): Promise<string> {
        const startTime = performance.now();

        // TODO: Consider if we can have a common entrypoint method and dispatch within that.

        try {
            const response = await this.client.generate({
                model: this.model,
                prompt: this.getSummaryPrompt(content),
                stream: false
            });

            const summary = response.response.trim();
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('Ollama Summary Generated:', summary);
            console.log('Ollama Summary Generation Time:', duration.toFixed(2), 'ms');


            return summary;
        } catch (error: unknown) {
            console.error('Ollama API Error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate summary from Ollama: ${errorMessage}`);
        }
    }

    async listKeywords(content: string): Promise<string[]> {
        try {
            const response = await this.client.generate({
                model: this.model,
                prompt: `Extract 5-10 important keywords from the following content. Return only the keywords as a comma-separated list without any additional text:\n\n${content}`,
                stream: false
            });

            // Split the response by commas and trim whitespace
            return response.response.split(',').map((keyword: string) => keyword.trim()).filter(Boolean);
        } catch (error: unknown) {
            console.error('Ollama API Error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to extract keywords from Ollama: ${errorMessage}`);
        }
    }

    async createEmbeddings(content: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings({
                model: this.model,
                prompt: content
            });

            return response.embedding;
        } catch (error: unknown) {
            console.error('Ollama API Error:', error);
            // Return a placeholder if embeddings fail
            console.warn('Returning placeholder embeddings due to API error');
            return Array(384).fill(0).map(() => Math.random() * 2 - 1);
        }
    }
}
