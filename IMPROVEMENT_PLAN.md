# Improvement Plan: Refactor OpenAI LLM Service to Use Official API Library

## Current Issue

The current implementation of `OpenAILLMService` in `llmService.ts` uses direct fetch requests to the OpenAI API endpoints. This approach has several drawbacks:

1. It requires manual handling of API requests and responses
2. It uses the older completions API with the deprecated `text-davinci-003` model
3. It lacks the benefits of the official OpenAI API library, such as type safety and built-in error handling

## Implemented Solution

Refactored the `OpenAILLMService` class to use the official OpenAI API library:

1. Installed the OpenAI API library: `npm install openai`
2. Updated the constants in `src/lib/constants.ts`:
   - Removed endpoint URLs as they're handled by the library
   - Updated to use the newer `gpt-3.5-turbo` model for chat completions
   - Kept the `text-embedding-ada-002` model for embeddings

3. Refactored the `OpenAILLMService` class to use the OpenAI library:
   - Added a client instance in the constructor
   - Updated methods to use the appropriate API calls
   - Improved error handling and maintained performance metrics

## Benefits

1. **Modern API Usage**: Now using the chat completions API with `gpt-3.5-turbo` instead of the older completions API
2. **Type Safety**: The OpenAI library provides TypeScript types for requests and responses
3. **Simplified Code**: Less boilerplate for API requests and response handling
4. **Better Error Handling**: The library provides more detailed error information
5. **Future Compatibility**: Easier to update to newer models and features as they become available

## Implementation Details

### 1. Updated Constants

```typescript
// OpenAI API Models
export const OPENAI_CHAT_MODEL = 'gpt-3.5-turbo';
export const OPENAI_EMBEDDINGS_MODEL = 'text-embedding-ada-002';
```

### 2. Refactored OpenAILLMService Class

```typescript
export class OpenAILLMService extends BaseLLMService {
    private client: OpenAI;

    constructor() {
        super();
        this.client = new OpenAI({
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

    // Similar refactoring for listKeywords() and generateEmbeddings() methods
}
```

## Future Enhancements

1. **Configuration Options**: Add more configuration options for model parameters
2. **Streaming Support**: Implement streaming responses for long content processing
3. **Retry Mechanism**: Add automatic retries for transient API errors
4. **Model Selection**: Allow users to select different models through the settings UI
5. **Function Calling**: Utilize OpenAI's function calling capabilities for more structured outputs

## Testing Plan

1. Test with valid API key and content
2. Test with invalid API key to verify error handling
3. Test with empty content
4. Test with very large content to check token limits
5. Test performance with various content sizes
6. Compare results with the previous implementation to ensure consistency

# Improvement Plan: Refactor LLM Service Architecture (Completed)

## Current Issue

The LLM service implementation had several TODOs and areas for improvement:

1. Uncertainty about the need for the BaseLLMService class
2. Reusing the same model for both text generation and embeddings in OllamaLLMService
3. Lack of a common entrypoint method for handling timing and error logic
4. Duplicate code across different LLM service implementations

## Implemented Solution

Refactored the LLM service architecture to improve code organization and maintainability:

1. **Template Method Pattern**: Implemented the Template Method pattern in BaseLLMService to handle common logic like timing and error handling
2. **Dedicated Embeddings Model**: Added support for a dedicated embeddings model in OllamaLLMService
3. **Improved Error Handling**: Added fallback mechanisms for embeddings generation with appropriate dimensionality
4. **Configuration Updates**: Added new configuration options for the Ollama embeddings model

## Benefits

1. **Reduced Code Duplication**: Common logic is now handled in the base class
2. **Better Error Handling**: Consistent error handling across all LLM services
3. **Improved Embeddings Quality**: Using dedicated models for embeddings should improve quality
4. **More Maintainable Code**: Clearer separation of concerns and better organization
5. **Easier to Add New LLM Services**: The base class provides a clear template for new implementations

# Improvement Plan: Complete OpenAI LLM Service Implementation (Completed)

[Previous implementation plan for OpenAI LLM Service - completed]
