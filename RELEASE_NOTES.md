## Activity Tree Calendar 1.1.0

The calendar now reliably returns to today when opened, and the README includes an automatically updated download history chart.

### Calendar improvements

- Opening the calendar from the ribbon or command palette selects today and displays the current month, even when reusing an existing view.
- When today is selected, the calendar follows the new local day after midnight and refreshes when the app regains focus after sleep.
- Manually selected historical dates remain selected during activity updates and date rollover, including selections made just after midnight.

### Download history

- Add a handwritten SVG chart to the English and Chinese READMEs.
- Collect official Obsidian download statistics daily through GitHub Actions, with support for manual updates.
- Include the maintainer-provided release baseline of 0 downloads on September 14, 2026.

Download statistics are collected by the repository workflow. The plugin continues to store activity locally without making network requests.

Requires Obsidian 1.7.2 or later.
