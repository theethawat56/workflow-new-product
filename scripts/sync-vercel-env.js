const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
    console.error('.env.local not found!');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

console.log('Syncing environment variables to Vercel (Production)...');

for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    // Split key and value, handling potential '=' in value
    const firstEqual = line.indexOf('=');
    if (firstEqual === -1) continue;

    const key = line.substring(0, firstEqual).trim();
    let value = line.substring(firstEqual + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }

    if (!key) continue;

    console.log(`Adding ${key}...`);

    try {
        // Create temp file for value
        const tmpFile = path.resolve(__dirname, '.env.val.tmp');
        fs.writeFileSync(tmpFile, value);

        // Run vercel env add <name> <target> <gitbranch> < <file>
        // We use 'production' target. gitbranch can be handled by just providing 'production' maybe?
        // Wait, error said: `vercel env add <name> <target> <gitbranch> < <file>`
        // Let's try explicit arguments: `production` and `main` (or whatever branch).
        // Or maybe just `production` works if we don't pipe?
        // No, piping requires specific args.
        // Let's try interactive pipe again but with correct newline sequence.
        // Or better: `echo -n "value" | vercel env add key production`
        // Standard usage: `echo -n "value" | vercel env add <name> <target> <gitbranch>`

        // Let's try simpler: `echo -n "${value}" | npx vercel env add ${key} production`
        // But value might fail with shell special chars.

        // Let's use `vercel env add` with full args and file input.
        // `npx vercel env add ${key} production main < "${tmpFile}"`
        // But what if branch isn't main? It might fail.

        // Fallback: Use `vercel env add [name] [environment]` and pipe value to stdin.
        // Command: `npx vercel env add ${key} production`
        // Input: value

        execSync(`npx vercel env add ${key} production`, {
            input: value,
            stdio: ['pipe', 'inherit', 'inherit'],
            encoding: 'utf-8'
        });

        fs.unlinkSync(tmpFile);

    } catch (e) {
        console.error(`Failed to add ${key}. It might already exist.`);
    }
}

console.log('Done!');
