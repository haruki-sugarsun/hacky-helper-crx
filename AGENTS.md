
# Agentic AI Development Notes for Hacky Helper

## Branch Management Strategy

### WIP (Work In Progress) Branches
- **Purpose**: For experimental development and feature exploration
- **Naming Convention**: `WIP/*` (e.g., `WIP/docs`, `WIP/tab-migration`)
- **PR Target**: Should point to corresponding `feature/*` branches

### Feature Branches
- **Purpose**: For stable feature development ready for integration
- **Naming Convention**: `feature/*` (e.g., `feature/tab-migration`, `feature/llm-integration`)
- **PR Target**: Should point to `main` or `develop` branches

### Workflow
1. Create `WIP/your-feature-name` for initial development
2. When feature is stable, create `feature/your-feature-name` from WIP branch
3. Update PR target from WIP branch to point to feature branch
4. Continue development on feature branch
5. Create PR from feature branch to main/develop when ready## Development Guidelines for Agentic Features

### Testing
- Create Vitest tests for agentic functionality
- Focus on message handling and task queue processing
- Test both online and offline scenarios

## Documentation Requirements

For new agentic features, ensure the following documentation is updated:

1. **ARCHITECTURE.md**: System architecture and component interactions
2. **DEVPLANS.md**: Development roadmap and implementation plans
3. **taskdocs/**: Specific task documentation and technical details
4. **designdocs/**: Detailed design documentation for agentic components
5. **AGENTS.md**: Development workflow and branch management guidelines

## Best Practices

- **Progressive Enhancement**: Ensure features work without AI/ML capabilities
- **User Control**: Provide clear toggles and settings for agentic features
- **Transparency**: Show when and how AI is being used
- **Performance**: Optimize LLM task processing to minimize resource usage
- **Error Handling**: Graceful degradation when LLM services are unavailable
