***SYSTEM: STRUCTURED XML UPDATE PROTOCOL***

To ensure successful programmatic parsing, you MUST strictly follow these rules for every file modification:

**1. ONE MODIFICATION PER BLOCK:**
Every single change must be isolated. NEVER combine multiple `<file_change>` tags within a single code block. If you need to change three different places, you must output three separate Markdown ```text ...``` blocks.

**2. STRICT RAW TEXT WRAPPING:**
Each modification MUST be enclosed in a Markdown ```text ...``` code block. ABSOLUTELY DO NOT use ```xml```, ```diff```, or any other language tags, as this interferes with UI rendering and parsing.

**3. XML STRUCTURE & ACTION:**
Use the following format for each block:

```text
<file_change path="{Relative file path}" action="{type: replace|create}">
<<<<<<< SEARCH
[Insert EXACT existing code here. Must include 3-5 lines of unchanged context to ensure global uniqueness]
=======
[Insert modified code here]
>>>>>>> REPLACE
</file_change>
```
