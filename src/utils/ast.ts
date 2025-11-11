import path from "path";
import { parse, print } from "recast";
import * as parser from "recast/parsers/typescript.js";
import { fileExists } from "./fs.js";

export type RouterType = "app" | "pages" | null;

export async function detectRouterType(appRoot: string): Promise<RouterType> {
  const appLayoutTsx = path.join(appRoot, "app/layout.tsx");
  const appLayoutJsx = path.join(appRoot, "app/layout.jsx");

  if ((await fileExists(appLayoutTsx)) || (await fileExists(appLayoutJsx))) {
    return "app";
  }

  const pagesAppTsx = path.join(appRoot, "pages/_app.tsx");
  const pagesAppJsx = path.join(appRoot, "pages/_app.jsx");

  if ((await fileExists(pagesAppTsx)) || (await fileExists(pagesAppJsx))) {
    return "pages";
  }

  return null;
}

export async function findEntryFile(appRoot: string, routerType: RouterType): Promise<string | null> {
  if (!routerType) return null;

  if (routerType === "app") {
    const tsx = path.join(appRoot, "app/layout.tsx");
    const jsx = path.join(appRoot, "app/layout.jsx");
    if (await fileExists(tsx)) return tsx;
    if (await fileExists(jsx)) return jsx;
  } else {
    const tsx = path.join(appRoot, "pages/_app.tsx");
    const jsx = path.join(appRoot, "pages/_app.jsx");
    if (await fileExists(tsx)) return tsx;
    if (await fileExists(jsx)) return jsx;
  }

  return null;
}

export function getExtensionForEntry(entryPath: string): "tsx" | "jsx" {
  return entryPath.endsWith(".jsx") ? "jsx" : "tsx";
}

interface PatchResult {
  success: boolean;
  code?: string;
  alreadyPatched?: boolean;
  error?: string;
}

export function patchAppRouterLayout(code: string, importPath: string): PatchResult {
  try {
    const ast = parse(code, { parser });
    let importAdded = false;
    let jsxAdded = false;
    let alreadyHasImport = false;
    let alreadyHasJsx = false;

    // Check if import already exists
    ast.program.body.forEach((node: any) => {
      if (
        node.type === "ImportDeclaration" &&
        node.source.value === importPath &&
        node.specifiers.some(
          (s: any) => s.type === "ImportDefaultSpecifier" && s.local.name === "NextPulseDev"
        )
      ) {
        alreadyHasImport = true;
      }
    });

    // Add import if not present
    if (!alreadyHasImport) {
      const importDecl = {
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: { type: "Identifier", name: "NextPulseDev" },
          },
        ],
        source: { type: "Literal", value: importPath },
      };
      ast.program.body.unshift(importDecl);
      importAdded = true;
    }

    // Find and patch the body element
    function traverse(node: any): boolean {
      if (!node || typeof node !== "object") return false;

      // Look for JSX element with name "body"
      if (
        node.type === "JSXElement" &&
        node.openingElement?.name?.name === "body"
      ) {
        // Check if NextPulseDev is already present
        const hasNextPulseDev = node.children?.some((child: any) => {
          return (
            child.type === "JSXExpressionContainer" &&
            child.expression?.type === "LogicalExpression" &&
            child.expression?.right?.type === "JSXElement" &&
            child.expression?.right?.openingElement?.name?.name === "NextPulseDev"
          );
        });

        if (hasNextPulseDev) {
          alreadyHasJsx = true;
          return true;
        }

        // Find the {children} expression
        const childrenIndex = node.children?.findIndex((child: any) => {
          return (
            child.type === "JSXExpressionContainer" &&
            child.expression?.type === "Identifier" &&
            child.expression?.name === "children"
          );
        });

        if (childrenIndex !== undefined && childrenIndex >= 0) {
          // Insert before {children}
          const jsxExpression = {
            type: "JSXExpressionContainer",
            expression: {
              type: "LogicalExpression",
              operator: "&&",
              left: {
                type: "BinaryExpression",
                operator: "===",
                left: {
                  type: "MemberExpression",
                  object: {
                    type: "MemberExpression",
                    object: { type: "Identifier", name: "process" },
                    property: { type: "Identifier", name: "env" },
                  },
                  property: { type: "Identifier", name: "NODE_ENV" },
                },
                right: { type: "Literal", value: "development" },
              },
              right: {
                type: "JSXElement",
                openingElement: {
                  type: "JSXOpeningElement",
                  name: { type: "JSXIdentifier", name: "NextPulseDev" },
                  selfClosing: true,
                  attributes: [],
                },
                closingElement: null,
                children: [],
              },
            },
          };

          node.children.splice(childrenIndex, 0, jsxExpression);
          jsxAdded = true;
          return true;
        }
      }

      // Traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              if (traverse(item)) return true;
            }
          } else {
            if (traverse(node[key])) return true;
          }
        }
      }

      return false;
    }

    traverse(ast);

    if (alreadyHasImport && alreadyHasJsx) {
      return { success: true, alreadyPatched: true };
    }

    if (!importAdded && !jsxAdded) {
      return { success: false, error: "Could not find body element to patch" };
    }

    return { success: true, code: print(ast).code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function patchPagesRouterApp(code: string, importPath: string): PatchResult {
  try {
    const ast = parse(code, { parser });
    let importAdded = false;
    let jsxAdded = false;
    let alreadyHasImport = false;
    let alreadyHasJsx = false;

    // Check if import already exists
    ast.program.body.forEach((node: any) => {
      if (
        node.type === "ImportDeclaration" &&
        node.source.value === importPath &&
        node.specifiers.some(
          (s: any) => s.type === "ImportDefaultSpecifier" && s.local.name === "NextPulseDev"
        )
      ) {
        alreadyHasImport = true;
      }
    });

    // Add import if not present
    if (!alreadyHasImport) {
      const importDecl = {
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: { type: "Identifier", name: "NextPulseDev" },
          },
        ],
        source: { type: "Literal", value: importPath },
      };
      ast.program.body.unshift(importDecl);
      importAdded = true;
    }

    // Find the default export function and patch its return
    function traverse(node: any): boolean {
      if (!node || typeof node !== "object") return false;

      // Look for return statement with JSX
      if (node.type === "ReturnStatement" && node.argument) {
        // Check if already has NextPulseDev
        if (node.argument.type === "JSXFragment") {
          const hasNextPulseDev = node.argument.children?.some((child: any) => {
            return (
              child.type === "JSXExpressionContainer" &&
              child.expression?.type === "LogicalExpression" &&
              child.expression?.right?.type === "JSXElement" &&
              child.expression?.right?.openingElement?.name?.name === "NextPulseDev"
            );
          });

          if (hasNextPulseDev) {
            alreadyHasJsx = true;
            return true;
          }

          // Add to fragment
          const jsxExpression = {
            type: "JSXExpressionContainer",
            expression: {
              type: "LogicalExpression",
              operator: "&&",
              left: {
                type: "BinaryExpression",
                operator: "===",
                left: {
                  type: "MemberExpression",
                  object: {
                    type: "MemberExpression",
                    object: { type: "Identifier", name: "process" },
                    property: { type: "Identifier", name: "env" },
                  },
                  property: { type: "Identifier", name: "NODE_ENV" },
                },
                right: { type: "Literal", value: "development" },
              },
              right: {
                type: "JSXElement",
                openingElement: {
                  type: "JSXOpeningElement",
                  name: { type: "JSXIdentifier", name: "NextPulseDev" },
                  selfClosing: true,
                  attributes: [],
                },
                closingElement: null,
                children: [],
              },
            },
          };

          node.argument.children.unshift(jsxExpression);
          jsxAdded = true;
          return true;
        } else if (node.argument.type === "JSXElement") {
          // Wrap in fragment
          const originalElement = node.argument;
          const jsxExpression = {
            type: "JSXExpressionContainer",
            expression: {
              type: "LogicalExpression",
              operator: "&&",
              left: {
                type: "BinaryExpression",
                operator: "===",
                left: {
                  type: "MemberExpression",
                  object: {
                    type: "MemberExpression",
                    object: { type: "Identifier", name: "process" },
                    property: { type: "Identifier", name: "env" },
                  },
                  property: { type: "Identifier", name: "NODE_ENV" },
                },
                right: { type: "Literal", value: "development" },
              },
              right: {
                type: "JSXElement",
                openingElement: {
                  type: "JSXOpeningElement",
                  name: { type: "JSXIdentifier", name: "NextPulseDev" },
                  selfClosing: true,
                  attributes: [],
                },
                closingElement: null,
                children: [],
              },
            },
          };

          node.argument = {
            type: "JSXFragment",
            openingFragment: { type: "JSXOpeningFragment" },
            closingFragment: { type: "JSXClosingFragment" },
            children: [jsxExpression, originalElement],
          };
          jsxAdded = true;
          return true;
        }
      }

      // Traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              if (traverse(item)) return true;
            }
          } else {
            if (traverse(node[key])) return true;
          }
        }
      }

      return false;
    }

    traverse(ast);

    if (alreadyHasImport && alreadyHasJsx) {
      return { success: true, alreadyPatched: true };
    }

    if (!importAdded && !jsxAdded) {
      return { success: false, error: "Could not find return statement to patch" };
    }

    return { success: true, code: print(ast).code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function revertAppRouterLayout(code: string, importPath: string): PatchResult {
  try {
    const ast = parse(code, { parser });
    let importRemoved = false;
    let jsxRemoved = false;

    // Remove import
    ast.program.body = ast.program.body.filter((node: any) => {
      if (
        node.type === "ImportDeclaration" &&
        node.source.value === importPath &&
        node.specifiers.some(
          (s: any) => s.type === "ImportDefaultSpecifier" && s.local.name === "NextPulseDev"
        )
      ) {
        importRemoved = true;
        return false;
      }
      return true;
    });

    // Remove JSX from body
    function traverse(node: any): boolean {
      if (!node || typeof node !== "object") return false;

      if (
        node.type === "JSXElement" &&
        node.openingElement?.name?.name === "body"
      ) {
        if (node.children) {
          const originalLength = node.children.length;
          node.children = node.children.filter((child: any) => {
            return !(
              child.type === "JSXExpressionContainer" &&
              child.expression?.type === "LogicalExpression" &&
              child.expression?.right?.type === "JSXElement" &&
              child.expression?.right?.openingElement?.name?.name === "NextPulseDev"
            );
          });
          if (node.children.length < originalLength) {
            jsxRemoved = true;
          }
        }
        return true;
      }

      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              if (traverse(item)) return true;
            }
          } else {
            if (traverse(node[key])) return true;
          }
        }
      }

      return false;
    }

    traverse(ast);

    if (!importRemoved && !jsxRemoved) {
      return { success: true, alreadyPatched: false };
    }

    return { success: true, code: print(ast).code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function revertPagesRouterApp(code: string, importPath: string): PatchResult {
  try {
    const ast = parse(code, { parser });
    let importRemoved = false;
    let jsxRemoved = false;

    // Remove import
    ast.program.body = ast.program.body.filter((node: any) => {
      if (
        node.type === "ImportDeclaration" &&
        node.source.value === importPath &&
        node.specifiers.some(
          (s: any) => s.type === "ImportDefaultSpecifier" && s.local.name === "NextPulseDev"
        )
      ) {
        importRemoved = true;
        return false;
      }
      return true;
    });

    // Remove JSX from return
    function traverse(node: any): boolean {
      if (!node || typeof node !== "object") return false;

      if (node.type === "ReturnStatement" && node.argument) {
        if (node.argument.type === "JSXFragment") {
          const originalLength = node.argument.children?.length || 0;
          node.argument.children = node.argument.children?.filter((child: any) => {
            return !(
              child.type === "JSXExpressionContainer" &&
              child.expression?.type === "LogicalExpression" &&
              child.expression?.right?.type === "JSXElement" &&
              child.expression?.right?.openingElement?.name?.name === "NextPulseDev"
            );
          });
          const newLength = node.argument.children?.length || 0;
          if (newLength < originalLength) {
            jsxRemoved = true;
            // If fragment only has one child left, unwrap it
            if (newLength === 1) {
              node.argument = node.argument.children[0];
            }
          }
          return true;
        }
      }

      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              if (traverse(item)) return true;
            }
          } else {
            if (traverse(node[key])) return true;
          }
        }
      }

      return false;
    }

    traverse(ast);

    if (!importRemoved && !jsxRemoved) {
      return { success: true, alreadyPatched: false };
    }

    return { success: true, code: print(ast).code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getImportPath(entryFile: string, componentFile: string): string {
  const dir = path.dirname(entryFile);
  let relativePath = path.relative(dir, componentFile);

  // Remove extension
  relativePath = relativePath.replace(/\.(tsx|jsx)$/, "");

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}
