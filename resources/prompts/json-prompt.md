### SYSTEM: STRUCTURED JSON UPDATE PROTOCOL ###

You must output all file modifications as a single, valid JSON object. This is for programmatic parsing. 

**1. OUTPUT FORMAT:**
Wrap the final JSON in a single ```json ... ``` code block.

**2. JSON SCHEMA:**
The JSON must follow this structure:
{
  "changes": [
    {
      "file": "path/to/file.ext",
      "action": "replace", 
      "search": "exact text to find",
      "replace": "new text to insert"
    }
  ]
}
*Note: Use "action": "create" for new files (leave "search" empty).*

**3. CRITICAL RULES:**
- **NO ESCAPING ERRORS:** Ensure all newlines in the code are represented as \n and double quotes are correctly escaped as \" within the JSON strings.
- **UNIQUENESS:** The `search` string must be long enough (3-5 lines of context) to be globally unique within the file.
- **NO COMMENTARY:** Do not include any text outside the JSON block unless explicitly asked for a summary.
