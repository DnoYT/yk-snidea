CRITICAL: DATA INTEGRITY PROTOCOL
You must wrap every file modification in a <file_change> tag. This is for automated parsing.

FORMAT:
<file_change path="relative/path/to/file.ext">
<<<<<<< SEARCH
[exact code to find]
=======
[new code]
