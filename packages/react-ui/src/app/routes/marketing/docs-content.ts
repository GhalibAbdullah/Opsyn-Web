export interface DocsPageItem {
  slug: string;
  title: string;
  content: string;
}

export interface DocsSection {
  title: string;
  pages: DocsPageItem[];
}

export const docsContent: DocsSection[] = [
  {
    title: 'Getting Started',
    pages: [
      {
        slug: 'what-is-opsyn',
        title: 'What is Opsyn?',
        content: `# What is Opsyn?

Opsyn is a modern **workflow automation and integration platform** designed for teams to sync data, automate repetitive tasks, and build complex business logic without writing code.

## Key Highlights

- **Visual Workflow Builder** — Design complex automations with an intuitive drag-and-drop canvas.
- **Extensive Integrations** — Connect to hundreds of apps and services through pre-built connectors.
- **Dynamic Webhooks** — Trigger flows using incoming data from any external system.
- **Team Collaboration** — Invite members, manage roles, and collaborate on automation flows in real-time.
- **Built-in Analytics** — Detailed execution history and performance metrics for every workflow.

## The Opsyn Platform

Opsyn is designed for reliability and scale:

- **Intelligent Engine** — A powerful core that handles flow orchestration, scheduling, and error handling.
- **Secure Execution** — All workflows run in isolated environments to protect your data.
- **Real-Time Monitoring** — Full visibility into every execution with detailed logs and success tracking.
`,
      },
      {
        slug: 'first-flow',
        title: 'Your First Flow',
        content: `# Creating Your First Flow

Getting started with Opsyn is easy. Follow these steps to build your first automation.

## 1. Create a New Flow
Click the **"New Flow"** button in your dashboard to open the visual builder canvas.

## 2. Set Your Trigger
Every flow starts with a trigger. Choose a Trigger step:
- **App Event** (e.g., "New Row in Google Sheets")
- **Schedule** (e.g., "Every Monday at 9 AM")
- **Webhook** (e.g., "Send data to this URL")

## 3. Add Actions
Click the **"+"** icon to add steps. You can add:
- **Integrations**: Send data to Slack, Gmail, HubSpot, and 200+ others.
- **Logic**: Use branches (if/else) or loops to handle complex data.
- **Data Tools**: Transform text, calculate numbers, or map fields.

## 4. Test and Publish
Once your flow is ready, click **"Test"** to ensure everything works as expected. When satisfied, click **"Publish"** to make your automation live.
`,
      },
    ],
  },
  {
    title: 'Platform Features',
    pages: [
      {
        slug: 'visual-builder',
        title: 'Visual Workflow Builder',
        content: `# Visual Workflow Builder

Opsyn's drag-and-drop canvas allows you to map out business processes exactly as they happen in the real world.

## Key Features

### Field Mapping
Easily map data from previous steps into the current action. No need to remember complex variables; just click and pick from the data picker.

### Branching Logic
Create conditional paths in your workflows. If an order is over $500, send it to a manager; if not, process it automatically.

### Looping
Process lists of data efficiently. Iterate over new users, daily sales reports, or a list of files with ease.

### Versioning
Opsyn automatically keeps track of changes. You can always view previous versions of your flows and roll back if needed.
`,
      },
      {
        slug: 'integrations-overview',
        title: 'Integrations',
        content: `# Supported Integrations

Opsyn connects with hundreds of tools you already use, allowing you to build seamless automations across your entire tech stack.

## Communication
- **Slack**
- **Discord**
- **Telegram**
- **Telegram Bot**
- **Twilio**
- **WhatsApp**
- **Microsoft Teams**

## Email
- **Gmail**
- **Outlook**
- **SendGrid**

## Google Workspace
- **Google Sheets**
- **Google Drive**
- **Google Docs**
- **Google Calendar**
- **Google Forms**
- **Google Contacts**

## AI & Automation
- **OpenAI**
- **Anthropic**
- **HuggingFace**
- **Stability AI**
- **CustomGPT**

## Productivity & Project Management
- **Notion**
- **Airtable**
- **Trello**
- **Asana**
- **ClickUp**
- **Monday**
- **Todoist**
- **Linear**

## Developer Tools
- **GitHub**
- **GitLab**
- **Bitbucket**
- **Jira**
- **Docker**

## Web & Utility
- **HTTP**
- **Webhook**
- **RSS**
- **JSON**
- **Text**
- **Code**
- **Delay**
- **Schedule**
- **Date**

## Payments & E-commerce
- **Stripe**
- **Shopify**
- **WooCommerce**
- **PayPal**

## CRM & Marketing
- **HubSpot**
- **Salesforce**
- **Mailchimp**
- **Pipedrive**
- **Facebook Leads**
- **Calendly**

## Storage & Files
- **Amazon S3**
- **Dropbox**
- **Box**
- **OneDrive**

## Customer Support
- **Zendesk**
- **Intercom**
- **Freshdesk**

## Databases & Data
- **PostgreSQL**
- **MySQL**
- **MongoDB**
- **Supabase**

## Other Platforms
- **Apify**
- **Typeform**
- **WordPress**
- **Twitter (X)**
- **PagerDuty**

**...and many more!**

## Managing Connections
All authenticated connections are managed in the **Connections** tab. We use industry-standard OAuth2 and secure API key storage to keep your access tokens safe.
`,
      },
      {
        slug: 'webhooks-scheduling',
        title: 'Webhooks & Scheduling',
        content: `# Webhooks & Scheduling

Trigger your automations exactly when you need them.

## Webhooks
Use Webhooks to receive data from any app that supports them. Opsyn provides a unique URL for each flow. When an external system sends an HTTP request to that URL, your flow begins immediately.

- **Instant Execution**: No polling required.
- **Payload Parsing**: Automatically handles JSON and form data.
- **Security**: Unique, obfuscated URLs for every workflow.

## Scheduling
Run flows on a recurring basis. Whether it's a daily report, a weekly cleanup task, or a monthly billing sync, our scheduler ensures it happens on time.

- **Cron Support**: Fine-grained control over execution timing.
- **Multiple Timezones**: Configure schedules relative to your local time.
`,
      },
      {
        slug: 'team-collaboration',
        title: 'Team Collaboration',
        content: `# Team Collaboration

Opsyn is built for teams. Stop sharing passwords and start collaborating in a secure, shared workspace.

## Features

- **Shared Workspaces**: All team members can view and edit flows in a central location.
- **Role-Based Access**: Define who can build, manage connections, or view logs.
- **Real-Time Presence**: See who is currently editing a flow to avoid conflicts.
- **Shared Connections**: Admins can set up connections (e.g., Company Slack) for the whole team to use safely.
`,
      },
      {
        slug: 'analytics',
        title: 'Flow Analytics',
        content: `# Flow Analytics & Logs

Monitor the health of your automations with detailed execution data.

## Execution History
Every time a flow runs, Opsyn creates a log entry. You can see:
- **Success/Failure Status**: Quickly identify issues.
- **Step-by-Step Data**: See exactly what data passed through each node.
- **Execution Time**: Track how long your automations take to complete.

## Performance Dashboard
Get high-level insights into your workspace performance:
- **Flow Success Rate**: Visualize reliability over time.
- **Task Usage**: Track your monthly automation volume.
- **Error Trends**: Spot recurring issues before they impact your business.
`,
      },
    ],
  },
  {
    title: 'Trust & Infrastructure',
    pages: [
      {
        slug: 'scalable-execution',
        title: 'Scalable Execution',
        content: `# Scalable Execution

Opsyn's engine is built for high availability and high throughput.

## Modern Architecture
Our infrastructure uses a distributed worker model. This means that as your automation needs grow, our platform scales horizontally to handle the load.

- **Parallel Processing**: Hundreds of workflows can execute simultaneously without delay.
- **Isolated Sandboxes**: Each workflow run is isolated, ensuring that errors in one flow never affect another.
- **Persistent Queues**: If a service goes down, Opsyn queues your tasks and retries them automatically when the system is back.
`,
      },
      {
        slug: 'security-privacy',
        title: 'Security & Privacy',
        content: `# Security & Privacy

We treat your data with the highest level of security.

## Data Encryption
- **Encryption at Rest**: Sensitive data, including connections and API keys, are encrypted using AES-256.
- **Encryption in Transit**: All communication between your browser and our servers happens over TLS (HTTPS).

## Secure Connections
We never store your passwords for third-party apps. Instead, we use OAuth2 tokens whenever possible, allowing you to revoke access at any time directly from the source application.

## Privacy First
- **Data Isolation**: Your data is logically separated from other customers.
- **Audit Logs**: Track sensitive actions within your workspace (admin only).
`,
      },
      {
        slug: 'deployment',
        title: 'Deployment Options',
        content: `# Deployment Options

Opsyn offers flexible deployment to suit your organization's needs.

## Opsyn Cloud
The easiest way to get started. Hosted, managed, and secured by our team. No infrastructure to maintain.
- **Auto-updates**: Always run the latest version.
- **Fully Managed**: We handle scaling, backups, and uptime.

## Self-Hosted (Enterprise)
For organizations that require full control over their data and infrastructure.
- **Air-Gapped Support**: Run Opsyn in private clouds or on-premise.
- **Custom Domain**: Host it on your own infrastructure.
- **Ownership**: You own the data, the logs, and the environment.

*Interested in self-hosting? [Contact our sales team](mailto:sales@opsyn.com).*
`,
      },
    ],
  },
];
