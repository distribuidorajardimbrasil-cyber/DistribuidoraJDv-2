const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const appFile = path.join(__dirname, 'src', 'App.tsx');

const replaceMap = {
  'bg-white': 'bg-white dark:bg-zinc-900',
  'bg-zinc-50': 'bg-zinc-50 dark:bg-zinc-950',
  'bg-zinc-100': 'bg-zinc-100 dark:bg-zinc-800/50',
  'border-zinc-100': 'border-zinc-100 dark:border-zinc-800/50',
  'border-zinc-200': 'border-zinc-200 dark:border-zinc-800',
  'text-zinc-900': 'text-zinc-900 dark:text-zinc-50',
  'text-zinc-800': 'text-zinc-800 dark:text-zinc-200',
  'text-zinc-700': 'text-zinc-700 dark:text-zinc-300',
  'text-zinc-600': 'text-zinc-600 dark:text-zinc-400',
  'text-zinc-500': 'text-zinc-500 dark:text-zinc-400',
  'shadow-sm': 'shadow-sm dark:shadow-none',
  'shadow-md': 'shadow-md dark:shadow-none',
  'shadow-lg': 'shadow-lg dark:shadow-none',
  'shadow-xl': 'shadow-xl dark:shadow-none',
  'shadow-2xl': 'shadow-2xl dark:shadow-none',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  Object.entries(replaceMap).forEach(([oldClass, newClasses]) => {
    // Only replace if it doesn't already have dark: prefix alongside it
    const regex = new RegExp(`\\b${oldClass}\\b(?!\\s*dark:)`, 'g');
    content = content.replace(regex, newClasses);
  });

  // some specific cleanups if it duplicated because running multiple times
  content = content.replace(/dark:bg-zinc-900 dark:bg-zinc-900/g, 'dark:bg-zinc-900');
  content = content.replace(/dark:text-zinc-50 dark:text-zinc-50/g, 'dark:text-zinc-50');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx')).map(f => path.join(componentsDir, f));
files.push(appFile);

files.forEach(processFile);
console.log('Done!');
