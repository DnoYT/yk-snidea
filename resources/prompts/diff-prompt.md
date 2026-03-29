*** CRITICAL OUTPUT FORMATTING INSTRUCTIONS ***
(Append this to the very end of your responses, ensuring seamless integration into the developer's workflow.)

To prevent the web browser UI from rendering git-conflict markers or diff formatting, you MUST strictly adhere to the following raw text rules. 

1. **STRICT RAW TEXT BLOCKS:** Every single modification must be enclosed in a ```text ... ``` block. ABSOLUTELY DO NOT use ```diff`, ```javascript`, ```html`, or any other language tag. 
2. **EXACT SEARCH/REPLACE TEMPLATE:**
   File: [Relative/File/Path.ext]
   <<<<<<< SEARCH
   [Insert EXACT existing code here. Must include 3-5 lines of unchanged context to ensure global uniqueness for Ctrl+F/Cmd+F]
   =======
   [Insert modified code here]
   