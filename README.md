<div align="center">
  <h1>🎨 EasyGit</h1>
  <p>Effortlessly craft professional GitHub profiles and repository documentation with this intuitive JavaScript-powered content assistant.</p>
  
  ![GitHub Stars](https://img.shields.io/github/stars/semyhist/EasyGit?style=for-the-badge&logo=github&logoColor=white&color=0891b2)
  ![License](https://img.shields.io/github/license/semyhist/EasyGit?style=for-the-badge&color=6366f1)
  ![Language](https://img.shields.io/badge/JavaScript-3178c6?style=for-the-badge&logo=javascript&logoColor=white)
</div>

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## About

Welcome to EasyGit! Are you tired of spending hours wrestling with Markdown, trying to make your GitHub profile and repository READMEs look polished and professional? EasyGit is here to change that. This simple JavaScript-based content assistant is designed to streamline the process of generating high-quality documentation for your projects and your personal GitHub presence.

Whether you're a seasoned developer looking to save time or new to the GitHub ecosystem and want to make a great first impression, EasyGit provides the tools and guidance to create compelling READMEs and attractive profiles. We believe that your code should shine, and your documentation should complement it, not detract from it. EasyGit empowers you to focus on what you do best: building amazing software.

---

## Key Features

✨ **Profile Generator** — Quickly create sections for your GitHub profile README, including "About Me," "Tech Stack," and "Projects."
✨ **README Assistant** — Generate well-structured README files for your repositories with essential sections like features, getting started, and usage.
✨ **Badge Integration** — Easily add dynamic badges for stars, license, language, and more to your profile and READMEs.
✨ **Code Snippet Formatting** — Provides examples and templates for common code snippets, ensuring proper syntax highlighting.
✨ **Project Showcase** — A structured way to list and describe your projects, complete with their respective tech stacks.
✨ **Intuitive Interface** — Designed with simplicity in mind, making it accessible for users of all skill levels.
✨ **Customizable Templates** — Offers flexible templates that you can adapt to your specific needs and personal style.

---

## Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Markdown-000000?style=flat&logo=markdown&logoColor=white" alt="Markdown"/>
</div>

---

## Getting Started

### Prerequisites

*   **Node.js**: Ensure you have Node.js installed (version 14.x or higher recommended). You can download it from [nodejs.org](https://nodejs.org/).
*   **npm** or **Yarn**: Package manager that comes with Node.js.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/semyhist/EasyGit.git
    cd EasyGit
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    or
    ```bash
    yarn dev
    ```

---

## Usage

EasyGit can be used in several ways, from generating content for your profile README to creating comprehensive READMEs for your projects.

### Example 1: Generating a Profile README Section

Let's say you want to add a "Tech Stack" section to your profile README.

```javascript
// Example usage within a JavaScript file or script
import { generateTechStackBadges } from './src/profileGenerator';

const technologies = ['JavaScript', 'React', 'Node.js'];
const techStackMarkdown = generateTechStackBadges(technologies);

console.log(techStackMarkdown);
/*
Output might look like:
<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js"/>
</p>
*/
```

### Example 2: Generating a Project README Section

Creating a "Getting Started" section for a new project:

```javascript
// Example usage within a JavaScript file or script
import { generateGettingStarted } from './src/readmeGenerator';

const gettingStartedContent = generateGettingStarted({
  gitCloneUrl: 'https://github.com/semyhist/YourNewProject.git',
  installCommand: 'npm install',
  devCommand: 'npm run dev'
});

console.log(gettingStartedContent);
/*
Output might look like:

## Getting Started

### Prerequisites

*   **Node.js**: Ensure you have Node.js installed.
*   **npm** or **Yarn**: Package manager.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/semyhist/YourNewProject.git
    cd YourNewProject
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
*/
```

---

## Project Structure

```
.
├── public/
├── src/
│   ├── components/
│   ├── utils/
│   ├── readmeGenerator.js
│   └── profileGenerator.js
├── index.html
├── package.json
└── README.md
```

---

## Contributing

We'd love to have you contribute to EasyGit! Here's how you can help:

1.  **Fork the Project**: Create your own fork of the repository.
2.  **Clone Locally**: Clone your fork to your local machine.
3.  **Create a Branch**: Make your changes on a new branch (`git checkout -b feature/AmazingFeature`).
4.  **Commit Changes**: Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5.  **Push to Branch**: Push to your branch (`git push origin feature/AmazingFeature`).
6.  **Open a Pull Request**: Submit a pull request to the main repository.

For more details, please check out the [CONTRIBUTING.md](CONTRIBUTING.md) file (if available) or open an issue!

You can also report any bugs or suggest features on the [Issues page](https://github.com/semyhist/EasyGit/issues).

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Created by Semih Aydın