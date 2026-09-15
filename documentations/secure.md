Leaving your Firestore database wide open with public read/write rules means anyone who inspects your frontend code can grab your database config and read or edit your entire collection, including sensitive member unit numbers and order data. 

Since Cloudflare Access only guards the HTML page loading at the domain level, it does not stop someone from directly hitting your Firestore API endpoints if the rules are left set to `allow read, write: if true;`.

You can lock down Firestore securely while keeping real-time sync working seamlessly for you and your family using Firebase Authentication.

---

### Step 1: Switch Firestore Rules to Require Auth

In your Firebase Console, navigate to **Firestore Database** $\rightarrow$ **Rules**, and change your rules so only authenticated users can read and write:



```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lock all collections by default
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

If members need to submit orders to a specific orders collection on the public Client H5 (index.html), give public create access only to that path while keeping everything else locked:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Member submissions (public create only)
    match /rounds/{roundId}/orders/{orderId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // Admin dashboard & member unit numbers (authenticated admins only)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

Step 2: Enable Anonymous Auth in Firebase
Instead of making your family members type in a separate username and password inside the app, use Firebase Anonymous Authentication:
 * Go to Firebase Console \rightarrow Authentication \rightarrow Sign-in method.
 * Enable Anonymous.
Step 3: Auto-Authenticate Admin Pages in Code
Inside your admin HTML files (/admin/index.html and /admin/dashboard.html), add an automatic sign-in trigger when the page loads:
import { getAuth, signInAnonymously, onAuthStateChanged } from "[https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js](https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js)";

const auth = getAuth();

// Automatically authenticate family members behind Cloudflare Access
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((error) => {
      console.error("Auth failed:", error);
    });
  } else {
    console.log("Authenticated ID:", user.uid);
    // Initialize your real-time Firestore listeners here
  }
});

How the Security Stack Works Together
 * Cloudflare Access acts as the outer gate, ensuring only you and authorized family members can open /admin/index.html or /admin/dashboard.html.
 * Once the page loads, Firebase Anonymous Auth silently grants a valid request.auth token to the browser session.
 * Firestore Security Rules verify that request.auth != null before serving unit numbers or allowing live edits.
 * Real-time Syncing: Firestore onSnapshot listeners continue to update instantly across all 3 family devices as orders and payments come in.

### Step 1: Switch Firestore Rules to Require Auth

In your Firebase Console, navigate to **Firestore Database** $\rightarrow$ **Rules**, and set permissions so any authenticated user (including anonymous sessions) can edit admin collections, while public clients can only create orders:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. Client Submissions (Public can only create orders, not view/edit)
    match /rounds/{roundId}/orders/{orderId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }

    // 2. Admin Collections & Unit Numbers (Admins / Family only)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

Step 2: Enable Anonymous Auth in Firebase
Instead of making family members type in a separate username and password inside the app:
 * Go to Firebase Console \rightarrow Authentication \rightarrow Sign-in method.
 * Click Anonymous and select Enable.
Step 3: Update Frontend Code (/admin/dashboard.html & /admin/index.html)
Replace your old 4-digit PIN check with an automatic sign-in trigger on page load:
import { initializeApp } from "[https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js](https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js)";
import { getAuth, signInAnonymously, onAuthStateChanged } from "[https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js](https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js)";
import { getFirestore, onSnapshot, doc } from "[https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js)";

// Your Firebase Config
const firebaseConfig = { /* ... your config ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Automatically sign in when the page loads behind Cloudflare Access
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Authenticated with Firebase UID:", user.uid);
    // Initialize your real-time Firestore listeners here
    loadDashboardData();
  } else {
    signInAnonymously(auth).catch((error) => {
      console.error("Firebase Auth failed:", error);
    });
  }
});

function loadDashboardData() {
  // Real-time listener works as normal across all family devices
  onSnapshot(doc(db, "admin_data", "current_round"), (doc) => {
    console.log("Current data:", doc.data());
  });
}


```

How Option 1 Works in Practice
1. First Visit (Verification)
When a family member opens wggrpbuy.cc/admin or wggrpbuy.cc/admin/dashboard.html for the first time:
 * Cloudflare Access Intercepts: Asks for their email address.
 * One-Time Passcode (OTP): They enter their email, receive a 6-digit verification code, and enter it.
 * Session Cookie Issued: Cloudflare sets an authentication cookie (default: valid for 30 days).
 * Silent Firebase Auth: Once through, the page executes signInAnonymously(auth) in the background without requiring passwords or PINs.
2. Subsequent Visits (Zero Friction)
 * For the duration of the session cookie (e.g., 30 days), Cloudflare recognizes their session and lets them straight in.
 * The page connects to Firebase automatically behind the scenes.
 * Family members can view unit numbers, edit sorting statuses, and update payment records immediately without entering a 4-digit PIN.
3. Session Expiration
 * Once the session cookie expires or history is cleared, Cloudflare prompts them to request a new OTP code.
 * Entering the new code grants another month of instant access.
Security Summary
 * Public Visitors: Anyone visiting /admin who is not on your Cloudflare whitelist will never pass the OTP screen.
 * Database Protection: Because Firebase Anonymous Auth runs after Cloudflare Access verification, external users cannot execute API requests to read or modify your Firestore database, securing your members' unit numbers.


