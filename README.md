# KSB LabelPrint

A responsive shipping-label workspace for creating, previewing, printing, and tracking KSB delivery labels. The frontend is hosted on GitHub Pages and synchronizes users, batch history, and analytics with Google Sheets through a Google Apps Script web app.

**Live app:** https://rayhanmawuntu-stack.github.io/LabelPrinter/

## Features

- Create and edit multiple recipients in one batch
- Original KSB physical label design preserved for printing
- A4 landscape print preview
- Multiple layouts: `3 × 3`, `3 × 2`, `2 × 2`, `2 × 1`, and `1 × 1`
- Fast import from Excel or Google Sheets
- User profiles linked to print activity
- Google Sheets synchronization
- Local cache for offline resilience
- Batch history with reload and delete actions
- Dashboard and analytics views
- Top users and top recipients rankings
- Responsive desktop and mobile interface
- Compact color-coded synchronization indicators

## Technology

- HTML, CSS, and vanilla JavaScript
- GitHub Pages
- Google Apps Script
- Google Sheets
- Browser local storage as a temporary cache

## Google Sheets backend setup

1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Add the backend code from the `apps-script` directory, or use the complete `Code.gs` backend prepared for this project.
4. Run the setup function once to create the required sheets.
5. Approve the requested Google permissions.
6. Select **Deploy → New deployment**.
7. Choose **Web app**.
8. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
9. Deploy and copy the URL ending in `/exec`.
10. Open the LabelPrint app, select the status dot or Settings, paste the Apps Script URL, and save the connection.

The backend creates and uses these sheets:

- `Users`
- `Login History`
- `Label History`
- `Generation Log`

## Frontend deployment

The repository is configured for GitHub Pages deployment. Changes pushed to the `main` branch are deployed through GitHub Actions.

To deploy under another GitHub account:

1. Fork or clone this repository.
2. Open **Settings → Pages** in the GitHub repository.
3. Select **GitHub Actions** as the source.
4. Update the default Apps Script endpoint in `assets/app-01.js` when required.
5. Push the changes to `main`.

## Project structure

```text
LabelPrinter/
├── index.html
├── assets/
│   ├── bootstrap.js
│   ├── app-01.js ... app-05.js
│   └── style-01.css ... style-08.css
├── partials/
│   ├── body-01.html
│   ├── body-02.html
│   ├── body-03.html
│   └── body-04.html
└── apps-script/
    ├── Api.gs
    ├── Batch.gs
    ├── Helpers.gs
    ├── History.gs
    ├── Login.gs
    ├── Setup.gs
    ├── Storage.gs
    └── Users.gs
```

## Data flow

1. Recipient edits are cached locally in the browser.
2. Generated batches are saved to local history immediately.
3. When the Google Sheets backend is available, pending batches are synchronized automatically.
4. Remote users and history are loaded and merged with the local cache.
5. Analytics are calculated from synchronized batch history.

## Sync indicators

- **Green:** synchronized
- **Yellow:** pending or connecting
- **Red:** synchronization error or offline

Select the top status dot to open the backend connection settings and view error details.

## Printing

The print template uses real millimetre dimensions and is intended for **A4 landscape** printing.

For the most accurate result:

- Set paper size to **A4**
- Use **Landscape** orientation
- Set scale to **100% / Actual size**
- Disable browser headers and footers
- Keep margins at the browser default unless the printer requires adjustment

The application interface can be redesigned independently from the physical label template. The original KSB label rules are kept separately in the print stylesheet.

## Troubleshooting

### The app shows a Sheets error

- Confirm the Apps Script URL ends in `/exec`.
- Confirm the web app access setting is **Anyone**.
- Open this URL directly in a browser:

```text
YOUR_APPS_SCRIPT_URL?action=ping
```

A working backend returns JSON containing `success: true`.

### Old interface or data is still visible

Perform a hard refresh:

- Windows: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

For persistent cached data, clear the GitHub Pages site's local storage and reload.

### GitHub deployment is queued

Check the repository's **Actions** tab. GitHub-hosted runners may occasionally take several minutes to start.

## Maintainer

Created and maintained by **Rayhan Ardhana**.
