import { CONFIG_STORE } from './config_store';
import { 
    OLLAMA_API_URL_DEFAULT, 
    OLLAMA_MODEL_DEFAULT, 
    SUMMARY_PROMPT,
    KEYWORDS_PROMPT,
    OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDINGS_MODEL
} from './lib/constants';
import { Ollama } from 'ollama';
import OpenAI from 'openai';

// Base class for LLM services
abstract class BaseLLMService implements LLMService {
    // TODO: Now not sure if we need this base class?
    abstract createSummary(content: string): Promise<string>;
    abstract listKeywords(content: string): Promise<string[]>;
    abstract generateEmbeddings(content: string): Promise<number[]>;
    
    // Common method to get the summary prompt
    protected getSummaryPrompt(content: string): string {
        return `${SUMMARY_PROMPT}${content}`;
    }
    
    // Common method to get the keywords prompt
    protected getKeywordsPrompt(content: string): string {
        return `${KEYWORDS_PROMPT}${content}`;
    }
}

export interface LLMService {
    createSummary(content: string): Promise<string>;
    listKeywords(content: string): Promise<string[]>;
    generateEmbeddings(content: string): Promise<number[]>;
}

export class OpenAILLMService extends BaseLLMService {
    private client: OpenAI;

    constructor() {
        super();
        this.client = new OpenAI({
            // TODO: Have a OpenAI API Key config in settings.
            apiKey: 'placeholder', // Will be set dynamically in each method
        });
    }

    async createSummary(content: string): Promise<string> {
        const startTime = performance.now();

        const apiKey = await CONFIG_STORE.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.error('OpenAI API key not set.');
            throw new Error('OpenAI API key not set.');
        }

        // Update the API key dynamically
        this.client.apiKey = apiKey;

        try {
            const response = await this.client.chat.completions.create({
                model: OPENAI_CHAT_MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that summarizes content.' },
                    { role: 'user', content: this.getSummaryPrompt(content) }
                ],
                max_tokens: 150,
                temperature: 0.7,
            });

            const summary = response.choices[0].message.content?.trim() || '';

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('OpenAI Summary Generated:', summary);
            console.log('OpenAI Summary Generation Time:', duration.toFixed(2), 'ms');

            return summary;
        } catch (error) {
            console.error('Error generating summary:', error);
            throw new Error('Failed to generate summary.');
        }
    }

    async listKeywords(content: string): Promise<string[]> {
        const startTime = performance.now();

        const apiKey = await CONFIG_STORE.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.error('OpenAI API key not set.');
            throw new Error('OpenAI API key not set.');
        }

        // Update the API key dynamically
        this.client.apiKey = apiKey;

        try {
            const response = await this.client.chat.completions.create({
                model: OPENAI_CHAT_MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that extracts keywords from content.' },
                    { role: 'user', content: this.getKeywordsPrompt(content) }
                ],
                max_tokens: 100,
                temperature: 0.5,
            });

            const keywordsText = response.choices[0].message.content?.trim() || '';
            
            // Split the response by commas and trim whitespace
            const keywords = keywordsText.split(',').map((keyword: string) => keyword.trim()).filter(Boolean);

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('OpenAI Keywords Extracted:', keywords.join(', '));
            console.log('OpenAI Keywords Extraction Time:', duration.toFixed(2), 'ms');

            return keywords;
        } catch (error) {
            console.error('Error extracting keywords:', error);
            // Return empty array instead of throwing to prevent cascading failures
            return [];
        }
    }

    async generateEmbeddings(content: string): Promise<number[]> {
        const startTime = performance.now();

        const apiKey = await CONFIG_STORE.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.error('OpenAI API key not set.');
            throw new Error('OpenAI API key not set.');
        }

        // Update the API key dynamically
        this.client.apiKey = apiKey;

        try {
            const response = await this.client.embeddings.create({
                model: OPENAI_EMBEDDINGS_MODEL,
                input: content,
            });

            const embeddings = response.data[0].embedding;

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('OpenAI Embeddings Generated:', embeddings.length, 'dimensions');
            console.log('OpenAI Embeddings Generation Time:', duration.toFixed(2), 'ms');

            return embeddings;
        } catch (error) {
            console.error('Error generating embeddings:', error);
            // Return placeholder embeddings in case of failure to prevent cascading failures
            console.warn('Returning placeholder embeddings due to API error');
            return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
        }
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

    async createSummary(content: string): Promise<string> {
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
        const startTime = performance.now();
        
        try {
            const response = await this.client.generate({
                model: this.model,
                prompt: this.getKeywordsPrompt(content),
                stream: false
            });

            // Split the response by commas and trim whitespace
            const keywords = response.response.split(',').map((keyword: string) => keyword.trim()).filter(Boolean);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('Ollama Keywords Extracted:', keywords.join(', '));
            console.log('Ollama Keywords Extraction Time:', duration.toFixed(2), 'ms');
            
            return keywords;
        } catch (error: unknown) {
            console.error('Ollama API Error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to extract keywords from Ollama: ${errorMessage}`);
        }
    }

    async generateEmbeddings(content: string): Promise<number[]> {
        const startTime = performance.now();
        
        try {
            // TODO: Check if just reusing the model is OK or not.
            const response = await this.client.embeddings({
                model: this.model,
                prompt: content
            });
            
            const embeddings = response.embedding;
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log('Ollama Embeddings Generated:', embeddings.length, 'dimensions');
            console.log('Ollama Embeddings Generation Time:', duration.toFixed(2), 'ms');

            return embeddings;
        } catch (error: unknown) {
            console.error('Ollama API Error:', error);
            // Return a placeholder if embeddings fail
            console.warn('Returning placeholder embeddings due to API error');
            return Array(384).fill(0).map(() => Math.random() * 2 - 1);
        }
    }
}
