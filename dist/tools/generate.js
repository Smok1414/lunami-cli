import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { getCwd, getWorkspaceRoot } from '../state.js';
export function formatScaffoldRunInstructions(projectRoot, type) {
    if (type === 'python') {
        return `cd ${projectRoot}\npython main.py`;
    }
    return `cd ${projectRoot}\nnpm install\nnpm run dev`;
}
function scaffoldReadmeRunSection(name, type) {
    const lines = formatScaffoldRunInstructions(name, type).split('\n');
    return `## Run\n\n\`\`\`bash\n${lines.join('\n')}\n\`\`\`\n`;
}
export async function generateProject(name, type) {
    validateProjectName(name);
    validateProjectType(type);
    const currentCwd = getCwd();
    const workspaceRoot = getWorkspaceRoot();
    const projectRoot = resolve(currentCwd, name);
    const relativeRoot = relative(workspaceRoot, projectRoot);
    if (relativeRoot.startsWith('..') || isAbsolute(relativeRoot)) {
        throw new Error(`Project path outside workspace is not allowed: ${name}`);
    }
    const files = getTemplateFiles(name, type);
    await mkdir(projectRoot, { recursive: false });
    const createdFiles = [];
    for (const file of files) {
        const absolutePath = resolve(projectRoot, file.path);
        const relativePath = relative(workspaceRoot, absolutePath);
        if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
            throw new Error(`Generated file path outside workspace is not allowed: ${file.path}`);
        }
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, file.content, 'utf8');
        createdFiles.push(relative(currentCwd, absolutePath));
    }
    const root = relative(currentCwd, projectRoot);
    return {
        ok: true,
        name,
        type,
        root,
        files: createdFiles,
        runInstructions: formatScaffoldRunInstructions(root, type)
    };
}
function validateProjectName(name) {
    if (!name.trim()) {
        throw new Error('Project name is required.');
    }
    if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
        throw new Error('Project name must be a single folder name.');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        throw new Error('Project name can contain only letters, numbers, dots, underscores, and dashes.');
    }
}
function validateProjectType(type) {
    if (!['react', 'node', 'next', 'python'].includes(type)) {
        throw new Error(`Unsupported project type: ${type}`);
    }
}
function getTemplateFiles(name, type) {
    switch (type) {
        case 'react':
            return createReactTemplate(name);
        case 'node':
            return createNodeTemplate(name);
        case 'next':
            return createNextTemplate(name);
        case 'python':
            return createPythonTemplate(name);
    }
}
function createReactTemplate(name) {
    return [
        {
            path: 'package.json',
            content: `${JSON.stringify({
                name,
                version: '0.1.0',
                private: true,
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'tsc --noEmit && vite build',
                    preview: 'vite preview'
                },
                dependencies: {
                    '@vitejs/plugin-react': '^4.3.4',
                    vite: '^6.0.7',
                    react: '^18.3.1',
                    'react-dom': '^18.3.1'
                },
                devDependencies: {
                    '@types/react': '^18.3.18',
                    '@types/react-dom': '^18.3.5',
                    typescript: '^5.7.2'
                }
            }, null, 2)}\n`
        },
        {
            path: 'index.html',
            content: `<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n`
        },
        {
            path: 'src/main.tsx',
            content: `import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {App} from './App';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`
        },
        {
            path: 'src/App.tsx',
            content: `export function App() {\n  return (\n    <main className="shell">\n      <section className="panel">\n        <p className="eyebrow">${name}</p>\n        <h1>React scaffold is ready.</h1>\n        <p>Start editing <code>src/App.tsx</code>.</p>\n      </section>\n    </main>\n  );\n}\n`
        },
        {
            path: 'src/styles.css',
            content: `:root {\n  color: #f7f7f7;\n  background: #05070b;\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n}\n\nbody {\n  margin: 0;\n}\n\n.shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 32px;\n}\n\n.panel {\n  max-width: 640px;\n  border: 1px solid #163047;\n  border-radius: 8px;\n  padding: 32px;\n  background: #080d14;\n}\n\n.eyebrow {\n  color: #f3ead7;\n  margin: 0 0 12px;\n}\n\nh1 {\n  margin: 0 0 12px;\n  font-size: 40px;\n}\n\np {\n  color: #b8c0cc;\n}\n`
        },
        {
            path: 'tsconfig.json',
            content: `${JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    useDefineForClassFields: true,
                    lib: ['DOM', 'DOM.Iterable', 'ES2020'],
                    allowJs: false,
                    skipLibCheck: true,
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true,
                    strict: true,
                    forceConsistentCasingInFileNames: true,
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    resolveJsonModule: true,
                    isolatedModules: true,
                    noEmit: true,
                    jsx: 'react-jsx'
                },
                include: ['src']
            }, null, 2)}\n`
        },
        {
            path: 'vite.config.ts',
            content: `import {defineConfig} from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()]\n});\n`
        },
        {
            path: 'README.md',
            content: `# ${name}\n\nReact + Vite scaffold generated by LUNAMI CLI.\n\n${scaffoldReadmeRunSection(name, 'react')}`
        }
    ];
}
function createNodeTemplate(name) {
    return [
        {
            path: 'package.json',
            content: `${JSON.stringify({
                name,
                version: '0.1.0',
                private: true,
                type: 'module',
                scripts: {
                    dev: 'tsx src/index.ts',
                    build: 'tsc --noEmit',
                    start: 'node dist/index.js'
                },
                dependencies: {},
                devDependencies: {
                    '@types/node': '^22.10.2',
                    tsx: '^4.19.2',
                    typescript: '^5.7.2'
                }
            }, null, 2)}\n`
        },
        {
            path: 'src/index.ts',
            content: `function main(): void {\n  console.log('${name} is running.');\n}\n\nmain();\n`
        },
        {
            path: 'tsconfig.json',
            content: `${JSON.stringify({
                compilerOptions: {
                    target: 'ES2022',
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext',
                    strict: true,
                    esModuleInterop: true,
                    forceConsistentCasingInFileNames: true,
                    skipLibCheck: true,
                    outDir: 'dist',
                    rootDir: 'src',
                    types: ['node']
                },
                include: ['src/**/*.ts']
            }, null, 2)}\n`
        },
        {
            path: '.gitignore',
            content: `node_modules/\ndist/\n.env\n`
        },
        {
            path: 'README.md',
            content: `# ${name}\n\nNode.js TypeScript scaffold generated by LUNAMI CLI.\n\n${scaffoldReadmeRunSection(name, 'node')}`
        }
    ];
}
function createNextTemplate(name) {
    return [
        {
            path: 'package.json',
            content: `${JSON.stringify({
                name,
                version: '0.1.0',
                private: true,
                scripts: {
                    dev: 'next dev',
                    build: 'next build',
                    start: 'next start',
                    lint: 'next lint'
                },
                dependencies: {
                    next: '^15.1.3',
                    react: '^18.3.1',
                    'react-dom': '^18.3.1'
                },
                devDependencies: {
                    '@types/node': '^22.10.2',
                    '@types/react': '^18.3.18',
                    '@types/react-dom': '^18.3.5',
                    typescript: '^5.7.2'
                }
            }, null, 2)}\n`
        },
        {
            path: 'app/layout.tsx',
            content: `import type {Metadata} from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: '${name}',\n  description: 'Generated by LUNAMI CLI'\n};\n\nexport default function RootLayout({children}: {children: React.ReactNode}) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`
        },
        {
            path: 'app/page.tsx',
            content: `export default function Page() {\n  return (\n    <main className="shell">\n      <section className="panel">\n        <p>${name}</p>\n        <h1>Next.js scaffold is ready.</h1>\n      </section>\n    </main>\n  );\n}\n`
        },
        {
            path: 'app/globals.css',
            content: `body {\n  margin: 0;\n  color: #f7f7f7;\n  background: #05070b;\n  font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n}\n\n.shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 32px;\n}\n\n.panel {\n  border: 1px solid #163047;\n  border-radius: 8px;\n  padding: 32px;\n  background: #080d14;\n}\n\np {\n  color: #f3ead7;\n}\n`
        },
        {
            path: 'tsconfig.json',
            content: `${JSON.stringify({
                compilerOptions: {
                    target: 'ES2017',
                    lib: ['dom', 'dom.iterable', 'esnext'],
                    allowJs: false,
                    skipLibCheck: true,
                    strict: true,
                    noEmit: true,
                    esModuleInterop: true,
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: 'preserve',
                    incremental: true,
                    plugins: [{ name: 'next' }]
                },
                include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
                exclude: ['node_modules']
            }, null, 2)}\n`
        },
        {
            path: 'next-env.d.ts',
            content: `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// This file is generated by Next.js.\n`
        },
        {
            path: 'README.md',
            content: `# ${name}\n\nNext.js scaffold generated by LUNAMI CLI.\n\n${scaffoldReadmeRunSection(name, 'next')}`
        }
    ];
}
function createPythonTemplate(name) {
    return [
        {
            path: 'main.py',
            content: `def main() -> None:\n    print("${name} is running.")\n\n\nif __name__ == "__main__":\n    main()\n`
        },
        {
            path: 'requirements.txt',
            content: ``
        },
        {
            path: 'pyproject.toml',
            content: `[project]\nname = "${name}"\nversion = "0.1.0"\ndescription = "Generated by LUNAMI CLI"\nrequires-python = ">=3.11"\n`
        },
        {
            path: '.gitignore',
            content: `__pycache__/\n.venv/\n.env\n`
        },
        {
            path: 'README.md',
            content: `# ${name}\n\nPython scaffold generated by LUNAMI CLI.\n\n${scaffoldReadmeRunSection(name, 'python')}`
        }
    ];
}
