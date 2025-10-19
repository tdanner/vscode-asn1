# vscode-asn1

VS Code extension that adds syntax highlighting, semantic tokens, and symbol navigation for ASN.1 and SNMP MIB files. It automatically manages the bundled [ASN.1 language server](https://github.com/tdanner/asn1-lsp) and relies on the [Tree-sitter ASN.1 grammar](https://github.com/tdanner/tree-sitter-asn1).

## Settings

- `asn1Lsp.serverPath`: Provide an explicit filesystem path to a pre-installed `asn1-lsp` binary if you do not want the extension to download one automatically.
- `asn1Lsp.releaseChannel`: Choose which GitHub release channel (`latest` or `nightly`) the extension uses when downloading the managed language server binary.
