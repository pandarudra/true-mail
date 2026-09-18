1. 📥 Inbox
   Inbox - Main place where received emails appear.
   Unread emails - Clearly distinguish emails that haven't been opened.
   Unread count - Show the number of unread messages.
   Email preview - Show sender, subject, preview text, and timestamp.
   Email grouping - Group related messages into conversations.
   Refresh - Fetch the latest mailbox state.
   Pagination / infinite scroll - Handle large mailboxes efficiently.
   Select multiple emails - Select messages for bulk actions.
   Bulk actions - Archive, delete, mark read/unread, spam, etc.
2. ✉️ Compose
   Compose - Create a new email.
   To - Primary recipients.
   CC - Visible additional recipients.
   BCC - Hidden additional recipients.
   Subject - Email subject.
   Rich text editor - Bold, italic, lists, links, formatting, etc.
   Attachments - Attach files.
   Inline images - Place images directly inside the email.
   Emoji - Insert emojis.
   Links - Add clickable hyperlinks.
   Signature - Automatically add a predefined signature.
   From selector - Choose which custom-domain address sends the email.
   Autosave - Automatically save unfinished messages.
   Discard - Delete the current draft.
   Send - Send the email.
3. 📝 Drafts
   Drafts - Emails that haven't been sent.
   Autosave - Save changes automatically while composing.
   Resume draft - Continue an unfinished email later.
   Draft attachments - Preserve attachments in drafts.
   Discard draft - Permanently remove a draft.
4. 📤 Sent
   Sent mail - View all outgoing emails.
   Delivery status - Show whether an email was sent/delivered.
   Failed status - Show emails that failed to send.
   Bounce status - Show emails rejected by the recipient's mail server.
   Resend - Send a failed or previously sent email again.
   Open tracking - Optional, only if implemented carefully and transparently.
5. 🧵 Threads / Conversations

This is essential for a modern email client.

Conversation threading - Group related emails together.
Message-ID tracking - Identify individual messages.
In-Reply-To - Associate replies with the original message.
References - Maintain conversation relationships.
Collapsed messages - Keep long conversations compact.
Expand message - Open an individual message.
Reply - Respond to the current sender.
Reply All - Respond to everyone involved.
Forward - Forward the conversation/message.
Quote previous message - Include relevant previous content. 6. ↩️ Reply & Forward
Reply
Reply All
Forward
Inline reply
Quoted content
Attachments when forwarding
Change recipients
Change subject
Signature insertion 7. ⭐ Organization
Starred - Bookmark important emails.
Archive - Remove from Inbox without deleting.
Trash - Temporarily deleted messages.
Spam - Unwanted or suspicious messages.
Important - Mark messages as important.
Labels - User-created categories.
Folders - Optional folder-style organization.
Move to folder/label
Mark as read
Mark as unread
Pin - Keep important conversations at the top.
Snooze - Temporarily remove an email and return it later. 8. 🔎 Powerful Search

Search is one of the most important features of a serious email client.

Basic
Search sender
Search recipient
Search subject
Search email body
Search attachment filename
Advanced
from:github.com
to:me@gmail.com
subject:interview
has:attachment
is:unread
is:starred
after:2026-09-01
before:2026-09-18
Search filters
From
To
Subject
Date
Attachment
Read/unread
Starred
Label
Domain
Has link
Has attachment 9. 📎 Attachments
Upload attachment
Drag & drop files
Attachment preview
Download attachment
Image preview
PDF preview
Attachment metadata
Attachment size validation
Multiple attachments
Secure attachment URLs
Azure Blob Storage integration

Architecture:

Email
├── Metadata → Supabase PostgreSQL
│
└── Files → Azure Blob Storage 10. 🕐 Snooze

Allow users to temporarily hide emails.

Examples:

Snooze until:

Later today
Tomorrow morning
Tomorrow evening
Next week
Custom date/time

At the selected time:

Snoozed Email
↓
Scheduled time
↓
Returns to Inbox 11. ⏰ Scheduled Send

Allow users to compose now and send later.

Send now
Schedule send
├── Tomorrow morning
├── Tomorrow evening
└── Custom date/time

The backend needs a reliable job/scheduling mechanism.

12. 🏷️ Labels
    Create label
    Rename label
    Delete label
    Apply label
    Remove label
    Multiple labels per email
    Label filtering
    Label colors
    Nested labels

Example:

Labels

💼 Work
💻 GitHub
💰 Invoices
🎓 College
💼 Jobs 13. 📂 Smart Organization

A modern client can automatically organize incoming mail.

Possible categories:

Primary
Social
Promotions
Updates
Forums

Or a TrueMail-specific system:

Important
Work
Personal
Notifications
Receipts
Newsletters

For the MVP, manual labels are enough. Automated categorization can come later.

14. 🔔 Real-Time Notifications

When a new email arrives:

Resend
↓
Webhook
↓
TrueMail API
↓
Supabase
↓
Realtime
↓
Browser

Features:

New email notification
Inbox updates without refresh
Unread count updates
Desktop notifications
Sound notification, optional
Delivery status updates 15. 🌐 Custom Domain Management

This is core to TrueMail, unlike a normal email client.

Add domain
Remove domain
Domain verification
DNS instructions
DNS status
SPF status
DKIM status
DMARC status
Multiple domains
Domain health
Resend domain synchronization

Example:

Domains

✓ rudra.dev
Verified

✓ startup.com
Verified

⚠ project.dev
DNS configuration required 16. 📧 Multiple Email Addresses

Allow users to manage multiple identities.

hello@rudra.dev
support@rudra.dev
contact@rudra.dev
billing@rudra.dev

Features:

Create address
Delete address
Default address
Display name
Switch sender while composing
Separate signatures
Address-specific settings 17. 🔐 Security

Absolutely essential because TrueMail handles private email.

Secure authentication
Session management
Authorization
Encrypted Resend credentials
Webhook signature verification
Secure attachment access
Rate limiting
CSRF protection where applicable
Input validation
XSS protection
SQL injection protection
API authorization
Audit logs
Secure password handling
Account deletion
Data deletion

Most importantly:

Browser
❌
│
│ Resend API key
│
▼

TrueMail Backend
↓
Encrypted credential
↓
Resend

Never expose the user's Resend credentials to the browser.

18. 🛡️ Spam & Abuse

At minimum:

Spam folder
Mark as spam
Not spam
Block sender
Block domain
Report abuse
Basic suspicious-email indicators

Later:

Automated spam classification
Phishing detection
Malicious attachment detection
Suspicious link detection 19. 📊 Email Delivery

For outgoing messages:

Queued
↓
Sent
↓
Delivered

or:

Sent
↓
Bounced

Track:

Sent
Delivered
Bounced
Failed
Complained
Delivery timestamp
Error reason where available 20. 🔄 Email Webhooks

Resend webhook integration should handle:

email.received
email.sent
email.delivered
email.bounced
email.complained

Webhook processing should be:

Authenticated
Verified
Idempotent
Retry-safe
Logged 21. 🧠 Modern Productivity Features

These aren't required for the first MVP, but they make TrueMail feel premium.

Keyboard Shortcuts
c Compose
r Reply
a Reply all
f Forward
e Archive

# Delete

s Star
u Mark unread
/ Search
j Next email
k Previous email
Command Palette
⌘ K

Search or perform an action...

Compose
Search emails
Open inbox
Open drafts
Archive conversation
Mark as unread
Settings

This is particularly valuable if you're going for a Superhuman-style experience.

22. 👥 Contacts
    Contact list
    Contact name
    Email address
    Avatar
    Previous conversations
    Frequently contacted
    Autocomplete recipients
    Contact notes

When typing:

To: rud...
↓
Rudra Panda
rudra@domain.com 23. 📰 Newsletter Management

Modern mail clients increasingly need newsletter control.

Detect newsletters
Show newsletter sender
Unsubscribe
Newsletter grouping
Newsletter-only view
Promotional email filtering

Example:

Newsletters

GitHub
Medium
Vercel
Linear 24. 🧹 Inbox Cleanup

Useful productivity features:

Bulk delete
Bulk archive
Bulk mark read
Bulk label
Bulk move
Select all
Delete old emails
Find large attachments
Find unread emails
Find newsletters

Later:

Clean Inbox

2,431 unread emails

[ Review ] 25. 👁️ Reading Experience
Clean email reader
Responsive HTML emails
Plain-text fallback
Dark mode
Image loading controls
External image blocking
Link previews
Attachment previews
Full-screen reading
Conversation navigation 26. 🌙 Appearance
Light mode
Dark mode
System theme
Compact density
Comfortable density
Font preferences
Sidebar collapse
Responsive layout

For TrueMail's visual identity:

Minimal
Clean
Dense when needed
High information clarity
Subtle animations
Strong typography
Very little visual noise 27. 📱 Responsive / Mobile

The UI should work properly on:

Desktop
Laptop
Tablet
Mobile

Mobile navigation:

Inbox
Sent
Drafts
Search
Compose
Settings

The compose experience needs special attention on mobile.

28. ⚡ Performance

A modern email client should feel instant.

Optimistic UI
Pagination
Virtualized email lists for large inboxes
Lazy-load attachments
Cache mailbox data
Debounced search
Optimistic read/unread
Optimistic starring
Background synchronization
Efficient database indexes

Don't load 10,000 emails into the browser.

❌ SELECT \* FROM emails

✅ Paginated / cursor-based queries 29. 🗄️ Data Management

Users should have control over their data.

Export emails
Delete emails
Delete mailbox
Disconnect domain
Disconnect Resend
Delete account
Data retention settings

Potential export:

Export mailbox

[ Export as JSON ]
[ Export as CSV ]
[ Export emails ] 30. ⚙️ Settings
Account
Profile
Email
Password
Sessions
Delete account
Mail
Default sender
Signature
Compose settings
Conversation settings
Inbox layout
Notifications
New email
Desktop notifications
Sound
Delivery notifications
Domains
Connected domains
Verification
DNS status
Resend
Connection status
API credential management
Disconnect
Appearance
Theme
Density
Sidebar
Reading pane 31. 🤖 AI Features

Keep these after the core mail system is solid.

Email Summary
Summarize
Thread Summary
This conversation is about...
Smart Reply
Thanks, I'll take a look.

Sounds good, let's proceed.

I'll get back to you tomorrow.
AI Search

Instead of:

from:github.com after:2026-08-01

User could type:

Show me GitHub emails from last month
Writing Assistant
Make this more professional
Shorten this
Fix grammar
Change tone 32. 🧩 TrueMail-Specific Dashboard

Because TrueMail uses BYO Resend, the settings/dashboard should expose infrastructure health.

TrueMail

hello@rudra.dev

──────────────────────────

Domain
✓ Verified

Email
✓ Sending enabled
✓ Receiving enabled

Resend
✓ Connected

Storage
2.4 GB used

──────────────────────────

Mailbox
1,284 emails
43 unread
17 threads

This is something Gmail doesn't need to show because Gmail owns the infrastructure. TrueMail does not, so it becomes useful.

33. Recommended Navigation

For the first polished version:

┌─────────────────────┐
│ TrueMail │
│ │
│ ✏️ Compose │
│ │
│ 📥 Inbox │
│ ⭐ Starred │
│ 🕐 Snoozed │
│ 📤 Sent │
│ 📝 Drafts │
│ 📌 Important │
│ ⏰ Scheduled │
│ 📦 Archive │
│ 🚫 Spam │
│ 🗑️ Trash │
│ │
│ Labels │
│ ├─ Work │
│ ├─ Personal │
│ └─ GitHub │
│ │
│ + Create label │
│ │
│ ⚙️ Settings │
└─────────────────────┘ 34. Build Priority

Don't try to ship all of this simultaneously.

🔴 P0: Core Mail
Authentication
Resend connection
Domain connection
Domain verification
Mailbox
Inbox
Read email
Compose
Send
Sent
Receive
Webhook
🟠 P1: Essential UX
Threads
Reply
Reply All
Forward
Drafts
Autosave
Attachments
Azure Blob Storage
Read/unread
Starred
Archive
Trash
Spam
Search
Labels
Realtime
🟡 P2: Modern Mail
Snooze
Scheduled Send
Command Palette
Keyboard Shortcuts
Multiple domains
Multiple identities
Contacts
Newsletter management
Advanced search
Notifications
Inbox cleanup
🟢 P3: Premium
AI summaries
Smart replies
AI search
Writing assistant
Rules
Filters
Advanced automation
Analytics
Advanced collaboration
The TrueMail Core

If you strip everything down to the essential modern email experience, it is this:

             ┌──────────────┐
             │   TrueMail   │
             └──────┬───────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
    RECEIVE       MANAGE        SEND
       │            │            │
       ▼            ▼            ▼
    Inbox        Threads       Compose
    Webhook      Search        Reply
    Realtime     Labels        Forward
    Spam         Archive       Schedule
                 Star
                 Drafts
                 Trash
                 Attachments

For TrueMail, the differentiating foundation is:

Custom Domain +
BYO Resend +
Real Inbox +
Modern UX +
User-controlled data

That gives you a focused product instead of a 47-feature Gmail clone wearing a new hat. 📨
