# Bookmark Storage Encoding Design

This document details the encoding strategy used for storing session information and open tabs as bookmarks. The implementation is provided in `bookmark_storage.ts`.

## Overview

The system leverages bookmark metadata to encode critical session and tab details in a human-readable yet structured format. This approach simplifies the management and synchronization process while reusing the browser's inherent bookmarking functionality.

## Session Information in Bookmarks

Each session is stored as a bookmark folder. The folder title combines the session name with JSON-encoded metadata.

### Encoding Details

- **Session Name**: The chosen name of the session.
- **Metadata (JSON encoded in title):**
  - `id`: A unique identifier (UUID) representing the session.
  - `updatedAt`: A Unix timestamp (milliseconds since epoch) indicating when the session was last modified locally.
- **Folder Title Format (Current):** The session folder title is composed of the session name followed by the JSON metadata. Implemented in `encodeSessionTitle`.

  ```
  My Session {"id":"abc12345-6789-def0","updatedAt":1680864000000}
  ```

- **Decoding (`decodeSessionTitle`):**
  - The primary decoding logic parses the current JSON format.
  - **Backward Compatibility:** The decoding logic also supports a legacy format where the session ID was enclosed in parentheses:
    ```
    My Session (abc12345-6789-def0)
    ```
  - *Note: A previously documented format `My Session {"lastModified": ...}` is not explicitly handled by the current decoding logic.*

**Example Current Folder Title:**

```
My Session {"id":"abc12345-6789-def0","updatedAt":1680864000000}
```

## Open Tabs in Bookmarks

Individual open tabs are stored as bookmarks. The bookmark title encodes the page title and associated JSON metadata.

### Encoding Details

- **Page Title**: The title of the web page or tab.
- **Metadata**: A JSON object encoded in the bookmark title which includes:
  - **lastModified**: A timestamp (in milliseconds since the Unix epoch) indicating when the tab was last modified.
  - **owner**: A string representing the Hacky-Helper-CRX instance that owns the tab.

**Example Bookmark Title:**

```
Example Page {"lastModified": 1680865000000, "owner": "instance-1"}
```

## Error Handling and Validation

Ensure robust error-checking when decoding JSON metadata:

- Handle malformed JSON gracefully.
- Validate timestamps to ensure they fall within expected ranges.
- Confirm that the owner field matches an active instance identifier.

## Additional Considerations

- **Data Consistency**: Regular checks should be implemented to prevent desynchronization between the stored bookmarks and the actual session state.
- **Extensibility**: The encoding format can be extended with additional metadata fields if necessary, while maintaining backward compatibility.
- **Security**: Avoid storing sensitive data within the bookmark metadata since it is stored in plain text.
- **Performance**: Efficient parsing and minimal processing overhead are critical, especially when handling a large number of open tabs.

## Future Enhancements

- Implement versioning in the metadata format to enable smooth migrations.
- Consider introducing compression if the metadata grows significantly.
- Integrate user-defined metadata to personalize session recovery behavior.

---

This encoding approach ensures that session and tab metadata is reliably captured within the bookmark storage, facilitating accurate reconstruction and synchronization of session data.
