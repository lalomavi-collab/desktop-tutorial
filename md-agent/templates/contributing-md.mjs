export function generateContributingMd(answers) {
  return `# Contributing to ${answers.projectName}

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: \`${answers.installCommand}\`
4. Create a feature branch: \`git checkout -b feature/my-feature\`

## Code Style

${answers.codingRules.map((r) => `- ${r}`).join("\n")}

## Commit Messages

Use conventional commits format:

\`\`\`
type(scope): description

feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Formatting, no code change
refactor: Code restructuring
test:     Adding tests
chore:    Maintenance tasks
\`\`\`

## Pull Request Process

1. Update documentation if needed
2. Make sure all tests pass: \`${answers.testCommand || "npm run test"}\`
3. Make sure linting passes: \`${answers.lintCommand || "npm run lint"}\`
4. Request review from a maintainer
`;
}
