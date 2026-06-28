const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

function cleanAndBuild() {
  const webSrc = path.join(__dirname, 'web', 'src');
  const webExt = path.join(__dirname, 'web', 'extensions');
  const src = path.join(__dirname, 'src');
  const ext = path.join(__dirname, 'extensions');

  // Clean old target folders
  if (fs.existsSync(webSrc)) {
    fs.rmSync(webSrc, { recursive: true, force: true });
  }
  if (fs.existsSync(webExt)) {
    fs.rmSync(webExt, { recursive: true, force: true });
  }

  // Copy fresh folder copies
  if (fs.existsSync(src)) {
    copyFolderRecursiveSync(src, path.join(__dirname, 'web'));
  }
  if (fs.existsSync(ext)) {
    copyFolderRecursiveSync(ext, path.join(__dirname, 'web'));
  }

  console.log('Web build compiled successfully!');
}

cleanAndBuild();
