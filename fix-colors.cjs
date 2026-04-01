const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const appFile = path.join(__dirname, 'src', 'App.tsx');

const replaceMap = {
  // Ambers
  'bg-amber-50': 'bg-amber-50 dark:bg-amber-900/20',
  'bg-amber-100': 'bg-amber-100 dark:bg-amber-900/40',
  'border-amber-100': 'border-amber-100 dark:border-amber-900/50',
  'text-amber-600': 'text-amber-600 dark:text-amber-400',
  'text-amber-700': 'text-amber-700 dark:text-amber-400',
  'text-amber-900': 'text-amber-900 dark:text-amber-100',
  
  // Emeralds
  'bg-emerald-50': 'bg-emerald-50 dark:bg-emerald-900/20',
  'bg-emerald-100': 'bg-emerald-100 dark:bg-emerald-900/40',
  'text-emerald-600': 'text-emerald-600 dark:text-emerald-400',
  'text-emerald-700': 'text-emerald-700 dark:text-emerald-400',
  
  // Blues
  'bg-blue-50': 'bg-blue-50 dark:bg-blue-900/20',
  'text-blue-600': 'text-blue-600 dark:text-blue-400',
  
  // Reds
  'bg-red-50': 'bg-red-50 dark:bg-red-900/20',
  'text-red-500': 'text-red-500 dark:text-red-400',
  'text-red-600': 'text-red-600 dark:text-red-400',
  'text-red-700': 'text-red-700 dark:text-red-400',
  
  // Indigos
  'bg-indigo-50': 'bg-indigo-50 dark:bg-indigo-900/20',
  'bg-indigo-100': 'bg-indigo-100 dark:bg-indigo-900/40',
  'text-indigo-600': 'text-indigo-600 dark:text-indigo-400',
  'text-indigo-700': 'text-indigo-700 dark:text-indigo-400',
  
  // Fix initial glitch with spaces
  '.charAt(0)': '.trim().charAt(0).toUpperCase()',
  ".substring(0, 2).toUpperCase()": ".trim().substring(0, 2).toUpperCase()"
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  Object.entries(replaceMap).forEach(([oldClass, newClasses]) => {
    // Only replace if it doesn't already have dark: prefix alongside it
    // Escaping dots and parentheses for regex if it's not a class
    if (oldClass.includes('(')) {
       // direct replace for code string
       content = content.replace(new RegExp(oldClass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), newClasses);
    } else {
       // Class replacement
       const regex = new RegExp(`\\b${oldClass}\\b(?!\\s*dark:)`, 'g');
       content = content.replace(regex, newClasses);
    }
  });

  // some specific cleanups if it duplicated because running multiple times
  content = content.replace(/dark:bg-amber-900\/20 dark:bg-amber-900\/20/g, 'dark:bg-amber-900/20');
  content = content.replace(/\.trim\(\)\.trim\(\)/g, '.trim()');
  content = content.replace(/\.toUpperCase\(\)\.toUpperCase\(\)/g, '.toUpperCase()');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx')).map(f => path.join(componentsDir, f));
files.push(appFile);

files.forEach(processFile);
console.log('Done!');
