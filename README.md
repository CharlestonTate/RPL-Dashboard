# 3D Printer Lab Dashboard

A real-time, scalable dashboard for managing 3D printer status in your lab, built with Firebase and HTML5.

## Quick Start

### 1. Firebase Setup (Already Done!)

Your Firebase project is already configured with these credentials:
- Project ID: `rpl-dashboard`
- Region: US

### 2. Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/project/rpl-dashboard/firestore)
2. Click "Create database" (if not already created)
3. Choose "Start in production mode" or "Test mode" (for development)
4. Select a region close to you

### 3. Set Firestore Security Rules

In the Firebase Console, go to Firestore Database → Rules and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for printers collection
    match /printers/{printer} {
      allow read: if true;
      allow write: if true;
    }
    
    // Allow read/write for audit log
    match /auditLog/{log} {
      allow read: if true;
      allow write: if true;
      allow update: if true;
    }
  }
}
```

**Note:** For production, you should add authentication and restrict write access.

### 4. Deploy Your App

**Option A: Local Testing**
1. Install a local server (e.g., `npm install -g http-server`)
2. Run: `http-server` in your project directory
3. Open `http://localhost:8080` in your browser

**Option B: Firebase Hosting**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

**Option C: Any Web Server**
Upload all files to your web server via FTP/SFTP.

## Usage

### Main Dashboard

1. **View Printer Status** - All printers are displayed with their current status
2. **Update Status** - Click any printer card to update its status
3. **Fill Required Fields:**
   - Your Name
   - New Status (UP/Maintenance/Down)
   - Notes (what's wrong, who's fixing it, etc.)
4. **View Audit Log** - Right panel shows all historical changes
5. **Expand Notes** - Click "Show Full Notes" to read complete details
6. **Edit Notes** - Click "Edit Notes" to update historical entries

### Admin Panel

Access via the ⚙️ Admin button in the header.

**Add New Printer:**
1. Enter Printer ID (lowercase, no spaces, e.g., "prusa5")
2. Enter Printer Name (display name, e.g., "Prusa 5")
3. Set Display Order (determines position in grid)
4. Click "Add Printer"

**Delete Printer:**
- Click "Delete" button next to any printer
- Confirm deletion (cannot be undone)

**Clear Audit Log:**
- Use with caution - permanently deletes all historical records
- Requires double confirmation

## Easy Customization

### Add More Printers (Method 1: Admin Panel)

The easiest way! Just use the admin panel - no coding required.

### Add More Printers (Method 2: Initial Configuration)

Edit `src/config.js` and add printers to the `INITIAL_PRINTERS` array:

```javascript
const INITIAL_PRINTERS = [
  { id: 'taz4', name: 'TAZ4', order: 1 },
  { id: 'prusa5', name: 'Prusa 5', order: 10 },  // Add new printers here
  { id: 'custom-printer', name: 'My Custom Printer', order: 11 }
];
```

These will auto-initialize on first load.

### Change Color Scheme

Edit `style.css` root variables:

```css
:root {
    --color-up: #10b981;        /* Green for UP status */
    --color-maintenance: #f59e0b; /* Yellow for Maintenance */
    --color-down: #ef4444;       /* Red for Down status */
    --color-primary: #3b82f6;    /* Blue for buttons/links */
}
```

### Adjust Grid Layout

In `style.css`, modify the printers grid:

```css
.printers-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    /* Change 200px to adjust card minimum width */
}
```

## Database Structure

### Printers Collection (`printers`)

```javascript
{
  id: "taz4",                    // Document ID (string)
  name: "TAZ4",                  // Display name (string)
  status: "up",                  // "up" | "maintenance" | "down"
  order: 1,                      // Display order (number)
  lastUpdated: Timestamp,        // Firebase timestamp
  lastUpdatedBy: "John Doe",     // User name (string)
  notes: "All working fine"      // Last update notes (string)
}
```

### Audit Log Collection (`auditLog`)

```javascript
{
  printerId: "taz4",             // Reference to printer ID
  printerName: "TAZ4",           // Printer name at time of change
  status: "maintenance",         // Status set
  updatedBy: "Jane Smith",       // User who made change
  notes: "Replacing nozzle",     // Detailed notes
  timestamp: Timestamp,          // When change was made
  editedAt: Timestamp            // (Optional) When notes were edited
}
```

## Scalability

This dashboard is designed to scale:

- ✅ **Unlimited Printers** - Add as many as you need
- ✅ **Cloud Storage** - Firebase handles all data storage
- ✅ **Real-Time Sync** - All devices update instantly
- ✅ **Automatic Backups** - Firebase provides built-in redundancy
- ✅ **High Availability** - 99.95% uptime SLA from Firebase
- ✅ **Easy Code Management** - Clean, modular, well-commented code

### Performance Notes

- Audit log limited to 100 most recent entries (configurable in `main.js`)
- Firestore free tier: 50K reads, 20K writes, 20K deletes per day
- For large scale, consider Blaze plan ($0.06 per 100K reads)

## File Structure

```
RPL-Dashboard/
├── index.html          # Main dashboard page
├── admin.html          # Admin panel page
├── style.css           # All styles and theming
├── README.md           # This file
└── src/
    ├── config.js       # Firebase configuration
    ├── main.js         # Main dashboard logic
    └── admin.js        # Admin panel logic
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Recommendations

For production use:

1. **Enable Authentication**
   - Add Firebase Authentication
   - Require users to sign in before making changes
   
2. **Update Firestore Rules**
   ```
   allow write: if request.auth != null;
   ```

3. **Restrict Admin Access**
   - Create admin role in Firebase Auth
   - Hide admin panel from regular users

4. **Add Rate Limiting**
   - Prevent spam status updates
   - Use Firebase App Check

## Troubleshooting

### Printers Not Loading
- Check browser console for errors
- Verify Firestore is enabled in Firebase Console
- Check Firestore security rules allow read access

### Can't Update Status
- Verify Firestore security rules allow write access
- Check internet connection
- Look for errors in browser console

### Changes Not Syncing
- Ensure all devices have internet connection
- Check Firebase Console for service status
- Verify all instances use same Firebase project

## Future Enhancements

Ideas for extending this dashboard:

- 📊 Usage statistics and analytics
- 🔔 Push notifications for status changes
- 📧 Email alerts for "Down" status
- 👥 User authentication and roles
- 📅 Maintenance scheduling
- 📈 Uptime tracking and reporting
- 🔗 Integration with printer APIs
- 📱 Native mobile app

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Firebase configuration
3. Review Firestore security rules
4. Check Firebase Console for quota limits

## License

Free to use and modify for your organization.

---

Built with ❤️ for 3D printing labs everywhere



