export function generateClaudeMd(answers) {
  const techList = answers.techStack.map((t) => `- ${t}`).join("\n");

  const folders = answers.folders
    .map((f) => `/${f.name.padEnd(14)}— ${f.description}`)
    .join("\n");

  const rules = answers.codingRules.map((r) => `- ${r}`).join("\n");

  const designRules = answers.designRules.map((r) => `- ${r}`).join("\n");

  const commands = answers.commands
    .map((c) => `${c.cmd.padEnd(18)}# ${c.description}`)
    .join("\n");

  return `# CLAUDE.md

## Project Overview

${answers.projectName} — ${answers.projectDescription}

## Tech Stack

${techList}

## Architecture

\`\`\`
${folders}
\`\`\`

### Key Patterns

${answers.patterns.map((p) => `- **${p.name}**: ${p.description}`).join("\n")}

## Coding Rules

${rules}

## Design System

${designRules}

## Commands

\`\`\`bash
${commands}
\`\`\`
`;
}
