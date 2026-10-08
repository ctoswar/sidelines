# Security Policy

## Supported versions

Security fixes are applied to the latest code on the `main` branch. There are
no versioned releases yet.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, email the maintainer directly at **ctos123game@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof of concept if you have one
- Any suggested fix, if you have one

You should receive a response within 72 hours. Please allow a reasonable time
for a fix to be prepared and published before disclosing the issue publicly.

## Scope notes

- Authentication in this repository currently uses browser `localStorage` as a
  demo persistence layer. It is **not** production authentication. Any findings
  related to replacing it with a real auth provider are welcome as regular
  issues rather than security reports.
- Never include real personal data, tokens, or credentials in reports or test
  fixtures.
