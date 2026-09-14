Here is how to structure your repository and routes cleanly when your Client H5 page, Admin Control panel, and Payment Dashboard are three separate HTML files.

Step 1: Organize Your Repository File Structure
Place your client-facing page at the root level as index.html so it automatically loads at wggrpbuy.cc. Group your administrative tools into a protected /admin folder:
 * index.html (Client H5 Ordering Page) \rightarrow Serves at wggrpbuy.cc/
 * /admin/index.html (Admin Control Panel) \rightarrow Serves at wggrpbuy.cc/admin/
 * /admin/dashboard.html (Group Buy Payment Dashboard) \rightarrow Serves at wggrpbuy.cc/admin/dashboard.html
> Tip: Setting the main Admin Control file as /admin/index.html allows you to access it simply by typing wggrpbuy.cc/admin without having to type .html in the URL.
> 

Step 2: Lock Down the Entire /admin Path in Cloudflare
Because both administrative files reside inside the /admin/ directory, a single Cloudflare Zero Trust rule will secure both files simultaneously:
 * Open Cloudflare Dashboard \rightarrow Click Zero Trust (left sidebar).
 * Go to Access \rightarrow Applications \rightarrow Click Add an Application \rightarrow Select Self-hosted.
 * Set the application settings:
   * Application Name: Group Buy Admin Suite
   * Application Domain: wggrpbuy.cc
   * Path: admin* (The wildcard * ensures both /admin/ and /admin/dashboard.html are protected)
 * Set the policy:
   * Action: Allow
   * Rule Type: Include
   * Selector: Emails
   * Value: Enter your authorized admin email address(es).
 * Click Save Application.

Step 3: Link Between Your Admin Tools
Inside your Admin Control panel (/admin/index.html), you can now safely add a direct navigation link or button pointing to your payment dashboard:

<!-- Inside /admin/index.html -->
<a href="/admin/dashboard.html">Go to Payment Dashboard</a>

Final Security Check
 * Public User (wggrpbuy.cc): Sees only the Client H5 ordering page (index.html).
 * Unauthenticated Access to Admin (wggrpbuy.cc/admin or wggrpbuy.cc/admin/dashboard.html): Cloudflare intercepts the request instantly and demands an Email OTP code before serving either file.
 * Firestore Security: Ensure your Firestore security rules enforce request.auth != null for write access on products or read/write access on payment tracking collections, ensuring data remains safe even if client-side code is inspected.

