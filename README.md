<h1 align="center">
  <img
    align="center"
    alt="OpSyn"
    src="./packages/react-ui/src/assets/img/custom/opsyn-favicon.svg"
    style="max-width: 120px; width: 100%; height: auto;"
  />
</h1>


<p align="center">
<a href="/LICENSE" target="_blank"><img src='https://img.shields.io/badge/license-MIT-green?style=for-the-badge' /></a>&nbsp;<img src='https://img.shields.io/github/commit-activity/w/Z-vren/opsyn-final/main?style=for-the-badge' />
</p>
<p align="center">
   An open source workflow automation platform
</p>

<p align="center">
  <a
    href="https://github.com/Z-vren/opsyn-final"
    target="_blank"
  ><b>Repository</b></a>&nbsp;&nbsp;&nbsp;🌪️&nbsp;&nbsp;&nbsp;
   <a
    href="https://github.com/Z-vren/opsyn-final/blob/main/LICENSE"
    target="_blank"
  ><b>License</b></a>
</p>

<br>
<br>

# 🤯 Welcome to OpSyn

OpSyn is an open-source workflow automation platform designed to be **extensible** through a **type-safe** pieces framework written in **TypeScript**. Built for teams that need powerful automation with enterprise-grade security and collaboration features.

<br>
<br>

## 🔥 Key Features:

### 🏢 **Projects & Multi-Platform Architecture**
- **Project-Based Organization**: Organize workflows into separate projects for better team collaboration and access control
- **Multi-Platform Support**: Each organization can have its own platform with isolated projects and users
- **Platform Isolation**: Secure multi-tenancy architecture ensures data separation between different platforms
- **Project Membership Management**: Invite team members to projects with role-based access (OWNER, EDITOR, VIEWER)
- **Member Visibility**: See the number of members in each project at a glance
- **Cross-Platform Collaboration**: Users can belong to multiple platforms and seamlessly switch between them

### 🔄 **Workflows & Automation**
- **Visual Flow Builder**: Intuitive drag-and-drop interface for building complex workflows
- **Flow Versioning**: All flows are fully versioned for safe iteration and rollback
- **Flow Analytics**: Track flow performance, execution metrics, and success rates
- **Workflow Comments**: Collaborate on flows with inline comments and discussions
- **Real-Time Collaboration**: Multiple team members can work on workflows simultaneously
- **No Developer Required**: Non-technical users can build and manage workflows without developer intervention

### 🔒 **Security & Access Control**
- **Role-Based Permissions**: Granular permissions system (OWNER, EDITOR, VIEWER) for project access
- **Connection Visibility**: Project members with READ_APP_CONNECTION permission can view all project connections (not just owners)
- **Automatic Cleanup**: When a user is removed from a project, their connections and associated data are automatically removed
- **Platform-Level Security**: Each platform operates in isolation with its own security policies
- **Self-Hosted**: Deploy on your own infrastructure for maximum security and data control
- **Secure Invitations**: Token-based invitation system with expiration and validation

### 🔌 **Integration Management**
- **200+ Pre-built Pieces**: Connect with Google Sheets, OpenAI, Discord, RSS, and many more services
- **Enable/Disable Pieces**: Project owners can control which integrations are available in their projects (Community Edition)
- **Custom Pieces**: Create your own TypeScript-based pieces with hot-reloading support
- **Connection Management**: Centralized management of all API connections and credentials
- **Connection Scoping**: Connections can be project-specific or platform-wide

### 🛠️ **Developer Experience**
- **TypeScript Framework**: All pieces are npm packages written in TypeScript
- **Hot Reloading**: Develop pieces locally with instant feedback
- **Open Ecosystem**: All piece source code is available and versioned on npmjs.com
- **Extensible Architecture**: Build custom pieces, actions, and triggers easily

### 🤖 **AI & Automation**
- **AI-First Design**: Native AI pieces for various providers
- **AI SDK**: Create your own AI agents to help build flows inside the builder
- **Human in the Loop**: Delay execution or require approval workflows
- **Human Input Interfaces**: Built-in support for Chat Interface 💬 and Form Interface 📝

### 💻 **User Experience**
- **Intuitive Interface**: Designed for both technical and non-technical users
- **Quick Learning Curve**: Get started building workflows in minutes
- **Dark/Light Themes**: Customizable appearance with system preference support
- **Multi-Language Support**: Internationalization support for global teams

## 🛠️  Builder Features:

- [x] **Projects**: Organize workflows into separate projects
- [x] **Flows**: Create and manage multiple workflows per project
- [x] **Loops**: Iterate over data collections
- [x] **Branches**: Conditional logic and routing
- [x] **Auto Retries**: Automatic error handling and retry logic
- [x] **HTTP Actions**: Make API calls directly from workflows
- [x] **Code Pieces**: Execute JavaScript/TypeScript code with NPM package support
- [x] **ASK AI**: Non-technical users can clean and transform data using AI
- [x] **Flow Versioning**: Full version control for workflows
- [x] **Flow Analytics**: Track execution metrics and performance
- [x] **Workflow Comments**: Collaborate with inline comments
- [x] **Real-Time Collaboration**: Multiple users working simultaneously
- [x] **Languages Translations**: Multi-language support (English, Spanish, French, German, Chinese, Japanese, Dutch, Portuguese)
- [x] **HTTP Actions**: Make API calls directly from workflows using the HTTP piece
- [x] **200+ Pieces**: Extensive library of integrations

## 🔌 Integration Management

OpSyn provides powerful integration management capabilities:

- **Enable/Disable Pieces**: Project owners can control which integrations are available in their projects (Community Edition). Platform-level piece management available in Enterprise Edition.
- **Connection Management**: Centralized management of API credentials and connections
- **Connection Scoping**: Project-specific or platform-wide connection sharing
- **Custom Pieces**: Build your own TypeScript-based integrations
- **Version Control**: All pieces are versioned and published to npmjs.com

## 🔒 Security Features

- **Connection Visibility**: Project members with appropriate permissions can view all project connections, enabling better collaboration
- **Automatic Data Cleanup**: When users are removed from projects, their connections and associated data are automatically removed
- **Role-Based Access Control**: Granular permissions for different user roles
- **Platform Isolation**: Complete data separation between platforms
- **Secure Invitations**: Token-based invitation system with expiration
- **Self-Hosted Deployment**: Full control over your data and infrastructure

## 🏗️ Architecture

OpSyn uses a **multi-platform, multi-project architecture**:

- **Platforms**: Top-level organizations that can have multiple projects
- **Projects**: Isolated workspaces containing flows, connections, and team members
- **Users**: Can belong to multiple platforms and projects simultaneously
- **Members**: Project-level access control with role-based permissions
- **Connections**: API credentials scoped to projects or platforms

This architecture enables:
- Enterprise multi-tenancy
- Team collaboration within projects
- Secure data isolation
- Flexible access management

## 🔌 Create Your Own Piece

OpSyn supports integrations with Google Sheets, OpenAI, Discord, RSS, and over 200 other services. As an **open ecosystem**, all integration source code is accessible in our repository. These integrations are versioned and published directly to npmjs.com.

You can easily create your own integration using our TypeScript framework with hot-reloading support for local development.

<br>
<br>
<br>
<br>

# License

OpSyn is released as open source under the [MIT license](https://github.com/Z-vren/opsyn-final/blob/main/LICENSE).

**Note:** OpSyn is based on [Activepieces](https://github.com/activepieces/activepieces), which is also licensed under the MIT license. We maintain the same open-source license to ensure compatibility and freedom for all users.

<br>
<br>

# 💭 Contributing

We welcome contributions big or small! Please check our [Contributing Guide](CONTRIBUTING.md) for details on how to contribute.

## 📚 Acknowledgments

OpSyn is built on top of [Activepieces](https://github.com/activepieces/activepieces), an excellent open-source workflow automation platform. We extend our gratitude to the Activepieces team and community for their foundational work.
