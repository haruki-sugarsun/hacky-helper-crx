# Voice Log UI Design Document

## 1. Purpose and Scope

- Capture and display live voice transcripts alongside typed content
- Provide an AI‑driven merge of keyboard and voice logs into a concise summary

## 2. Stakeholders

- Users who record voice transcripts
- UX/UI designers
- Frontend engineers

## 3. Key Requirements

- Display live interim speech recognition results
- Append final transcripts with timestamps or separators
- Merge keyboard input and voice log into a single improved text via LLM
- Toggle control to enable/disable automatic LLM merge
- Show LLM loading and error states in condensed area
- Persist and restore logs on page reload
- Prevent infinite auto-restart loops for recognition

## 4. UI Components

- **Status Indicator**: shows voice recognition on/off state
- **LLM Toggle Control**: checkbox to enable auto‑merge via LLM
- **LLM Status Indicator**: displays off/loading/on/error states
- **Transcript Pane**: scrollable container for final speech text
- **Condensed Log Pane**: editable container for merged output
- **Interim Display**: inline preview of current recognition
- **Controls**: recognition toggle switch, clear/export buttons

## 5. Interaction Flow

1. User toggles speech recognition on
2. Status updates to “Recognition is on”
3. Interim results appear in preview area
4. On final result:
   a. Append transcript to speech log pane
   b. Save to storage
   c. If LLM toggle is on:
   - Show loading state on condensed log
   - Send combined workarea and voice text to LLM service
   - On success, display merged text and update status to “LLM is on.”
   - On failure, show error state and status “Error”
5. User may toggle LLM merge on/off at any time
6. Recognition auto‑restarts within restart limit
7. User toggles recognition off to stop

## 6. Technical Considerations

- SpeechRecognition API events (`onstart`, `onresult`, `onend`)
- LLM integration using abstract LLMService (OpenAI/Ollama)
- Debounce or block new LLM calls while one is in progress
- CSS classes `.loading` & `.error` to indicate condensed log state
- Persist workarea, speech log, and condensed log via `chrome.storage.local`
- Configurable restart limit (`MAX_RESTARTS`) to avoid loops

## 7. Accessibility

- Ensure high contrast and readable font sizes
- Keyboard‑focusable toggle switches for recognition and LLM
- ARIA labels: `aria-label="Speech recognition toggle"`, `aria-label="LLM merge toggle"`
- Live region announcements for status updates

## 8. Testing Strategy

- Unit tests for `updateCondensedLog` with mocked LLMService scenarios (success, loading, error)
- UI tests for toggle controls, status text changes, and CSS class toggling
- Integration tests for storage persistence and auto‑restart behavior
- Manual QA for responsiveness, scrolling, and edge cases

## 9. Next Steps

- Review updated design doc with stakeholders
- Update `NEXT_TODO.md` with detailed LLM integration and testing tasks
- Create mockups or wireframes for LLM controls and statuses
- Implement unit and UI tests for LLM merge
- Polish CSS and ARIA attributes
