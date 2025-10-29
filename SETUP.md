# 🚀 Quick Setup Guide

Follow these steps to get your 3D Printer Dashboard running in 5 minutes!

## Step 1: Enable Firestore Database ⚡

1. Go to your [Firebase Console](https://console.firebase.google.com/project/rpl-dashboard)
2. Click **Firestore Database** in the left menu
3. Click **Create database**
4. Choose **Test mode** for now (we'll secure it later)
5. Select your region (choose one close to you)
6. Click **Enable**

## Step 2: Set Up Security Rules 🔒

1. In Firestore Database, click the **Rules** tab
2. Copy the rules from `firestore.rules` file
3. Paste into the editor
4. Click **Publish**

**Quick Copy:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /printers/{printerId} {
      allow read: if true;
      allow write: if true;
    }
    match /auditLog/{logId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if true;
    }
  }
}
```

## Step 3: Test Locally 💻

**Option A: Using Python** (if you have Python installed)
```bash
cd "C:\Users\charl\OneDrive\Documents\RPL-Dashboard ALPHA"
python -m http.server 8000
```
Then open: http://localhost:8000

**Option B: Using Node.js** (if you have Node.js installed)
```bash
npx http-server -p 8000
```
Then open: http://localhost:8000

**Option C: Using Visual Studio Code**
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## Step 4: Test the Dashboard ✅

1. Open the dashboard - you should see all 9 printers
2. Click on any printer card
3. Fill in:
   - Your name
   - Select a status
   - Add some notes
4. Click "Update Status"
5. Check the audit log on the right - your entry should appear!
6. Try expanding the notes
7. Try editing the notes

## Step 5: Try the Admin Panel ⚙️

1. Click the **⚙️ Admin** button in the header
2. Try adding a new printer:
   - ID: `test-printer`
   - Name: `Test Printer`
   - Order: `99`
3. Go back to the dashboard - your new printer should appear!
4. Try deleting the test printer from admin panel

## Step 6: Deploy to Production 🌐

### Option A: Firebase Hosting (Recommended)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
firebase init hosting
# Select your project: rpl-dashboard
# Public directory: . (current directory)
# Single-page app: No
# Overwrite files: No

# Deploy
firebase deploy --only hosting
```

Your app will be live at: `https://rpl-dashboard.web.app`

### Option B: Any Web Host

Just upload all files to your web server via FTP:
- index.html
- admin.html
- style.css
- src/ folder (all files inside)

## Step 7: Add to Lab Computers 🖥️

1. Open your deployed URL or local server
2. Bookmark it on all lab computers
3. Optional: Set as homepage for lab computers
4. Optional: Add desktop shortcut

## Customization Ideas 🎨

### Change to Light Mode
Edit `style.css` colors:
```css
:root {
    --color-bg: #ffffff;
    --color-bg-light: #f8fafc;
    --color-text: #1e293b;
}
```

### Add More Printers
Just use the Admin panel! No code changes needed.

### Change Status Colors
Edit in `style.css`:
```css
--color-up: #10b981;        /* Green */
--color-maintenance: #f59e0b; /* Yellow */
--color-down: #ef4444;       /* Red */
```

## Troubleshooting 🔧

### "Loading printers..." never goes away
- **Check:** Is Firestore enabled in Firebase Console?
- **Check:** Are security rules published?
- **Check:** Open browser console (F12) - any errors?

### Can't update status
- **Check:** Security rules allow write access
- **Check:** Internet connection is working
- **Check:** Browser console for errors

### Printers not syncing between devices
- **Check:** All devices connected to internet
- **Check:** All devices using same URL
- **Check:** Clear browser cache and refresh

### Firebase quota exceeded
- Free tier limits:
  - 50,000 reads per day
  - 20,000 writes per day
  - 1 GB storage
- **Solution:** Upgrade to Blaze plan (pay-as-you-go)

## Security for Production 🔐

Before going live to the public internet:

1. **Enable Firebase Authentication**
2. **Update security rules** (see `firestore.rules` for examples)
3. **Add admin roles** for managing printers
4. **Enable Firebase App Check** to prevent abuse
5. **Set up monitoring** in Firebase Console

## Next Steps 📚

- Read `README.md` for full documentation
- Customize the colors and layout
- Add your lab's logo to the header
- Set up email notifications (advanced)
- Add usage analytics (advanced)

## Need Help? 💬

Common commands:
- **Check Firebase status:** Open Firebase Console
- **View logs:** Browser Console (F12)
- **Reset database:** Delete collections in Firestore Console
- **Restart:** Just refresh the page!

---

**You're all set!** 🎉

Your lab now has a professional, real-time printer management system.

