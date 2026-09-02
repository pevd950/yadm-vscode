# Publishing

## GitHub release

Update `version` in `package.json` and `package-lock.json`, update
`CHANGELOG.md`, merge to `main`, then create and push a matching tag:

```bash
npm version patch
git push origin main --follow-tags
```

The Release workflow tests the extension and attaches the VSIX to a GitHub
release.

## VS Code Marketplace

1. Create the permanent `pevd950` publisher at
   https://marketplace.visualstudio.com/manage if it does not exist.
2. Create a short-lived Azure DevOps token with **Marketplace: Manage** scope,
   or configure Microsoft's recommended Entra workload identity.
3. Package and inspect the extension:

   ```bash
   npm ci
   npm test
   npm run package
   ```

4. Publish without placing credentials in files or shell history:

   ```bash
   npx vsce login pevd950
   npx vsce publish
   ```

Global Azure DevOps PATs retire on December 1, 2026. Prefer Entra workload
identity for long-term automated Marketplace publishing.
