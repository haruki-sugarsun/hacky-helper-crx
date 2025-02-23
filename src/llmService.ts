import { CONFIG_STORE } from './config_store';

// Constants for the messaging interactions between Ext pages:
export const CREATE_SUMMARY = 'CREATE_SUMMARY';
export const LIST_KEYWORDS = 'LIST_KEYWORDS';
export const CREATE_EMBEDDINGS = 'CREATE_EMBEDDINGS';

export interface LLMService {
    createSummary(content: string): Promise<string>;
    listKeywords(content: string): Promise<string[]>;
    createEmbeddings(content: string): Promise<number[]>;
}

export class OpenAILLMService implements LLMService {

    async createSummary(content: string): Promise<string> {
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
                prompt: `Summarize the following content:\n\n${content}`,
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            console.error('LLM API Error:', response.statusText);
            throw new Error('Failed to generate summary.');
        }

        const data = await response.json();
        return data.choices[0].text.trim();
    }

    async listKeywords(content: string): Promise<string[]> {
        // Implement keyword extraction logic using OpenAI or replace with actual implementation
        // Placeholder implementation
        return ['keyword1', 'keyword2', 'keyword3'];
    }

    async createEmbeddings(content: string): Promise<number[]> {
        // Implement embeddings creation logic using OpenAI or replace with actual implementation
        // Placeholder implementation
        return [0.1, 0.2, 0.3];
    }
}

export class OllamaLLMService implements LLMService {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async createSummary(content: string): Promise<string> {
        const response = await fetch(`${this.apiUrl}/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });

        if (!response.ok) {
            console.error('Ollama API Error:', response.statusText);
            throw new Error('Failed to generate summary from Ollama.');
        }

        const data = await response.json();
        return data.summary.trim();
    }

    async listKeywords(content: string): Promise<string[]> {
        // Implement keyword extraction logic using Ollama or replace with actual implementation
        // Placeholder implementation
        return ['keyword1', 'keyword2', 'keyword3'];
    }

    async createEmbeddings(content: string): Promise<number[]> {
        // Implement embeddings creation logic using Ollama or replace with actual implementation
        // Placeholder implementation
        return [0.1, 0.2, 0.3];
    }
}
