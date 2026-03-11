export function generateReadmeMd(answers) {
  const techBadges = answers.techStack
    .map(
      (t) =>
        `![${t}](https://img.shields.io/badge/-${encodeURIComponent(t)}-333?style=flat-square)`
    )
    .join(" ");

  const commands = answers.commands
    .map((c) => `| \`${c.cmd}\` | ${c.description} |`)
    .join("\n");

  return `# ${answers.projectName}

${answers.projectDescription}

## Tech Stack

${techBadges}

## Getting Started

### Prerequisites

${answers.prerequisites.map((p) => `- ${p}`).join("\n")}

### Installation

\`\`\`bash
git clone <repo-url>
cd ${answers.projectName.toLowerCase().replace(/\s+/g, "-")}
${answers.installCommand}
\`\`\`

### Available Commands

| Command | Description |
|---------|-------------|
${commands}

## Project Structure

\`\`\`
${answers.folders.map((f) => `/${f.name.padEnd(14)}— ${f.description}`).join("\n")}
\`\`\`

## Contributing

${answers.contributingNotes || "Pull requests are welcome. Please open an issue first to discuss what you would like to change."}

## License

${answers.license}
`;
}
