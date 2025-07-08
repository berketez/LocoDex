const { dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// yauzl'ı optional olarak yükle
let yauzl = null;
try {
  yauzl = require('yauzl');
} catch (error) {
  console.warn('yauzl module not available:', error.message);
}

const GITHUB_REPO_OWNER = 'berketez'; // GitHub kullanıcı adı veya organizasyon adı
const GITHUB_REPO_NAME = 'LocoDex'; // GitHub repo adı
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

async function fetchLatestReleaseTag() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'LocoDex-Updater'
      },
      timeout: 5000 // 5 saniye timeout
    };
    
    const req = https.get(`${GITHUB_API_BASE}/releases/latest`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve(release.tag_name);
        } catch (e) {
          reject(new Error('Failed to parse release data: ' + e.message));
        }
      });
    }).on('error', (e) => {
      reject(new Error('Failed to fetch latest release: ' + e.message));
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function extractZip(zipPath, destPath) {
  if (!yauzl) {
    throw new Error('yauzl module not available - cannot extract zip files');
  }
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.on('entry', (entry) => {
        const fullPath = path.join(destPath, entry.fileName);

        if (/[\\/]$/.test(entry.fileName)) { // Directory
          fs.mkdir(fullPath, { recursive: true }, (err) => {
            if (err) return reject(err);
            zipfile.readEntry();
          });
        } else { // File
          fs.mkdir(path.dirname(fullPath), { recursive: true }, (err) => {
            if (err) return reject(err);
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              const writeStream = fs.createWriteStream(fullPath);
              readStream.pipe(writeStream);
              writeStream.on('finish', () => {
                zipfile.readEntry();
              });
              writeStream.on('error', reject);
            });
          });
        }
      });

      zipfile.on('end', () => {
        resolve();
      });

      zipfile.on('error', reject);
      zipfile.readEntry();
    });
  });
}

async function checkAndApplyCodeUpdates(mainWindow) {
  try {
    const currentVersion = app.getVersion();
    console.log('Current version:', currentVersion);
    
    // Timeout ile güncelleme kontrolü
    const latestTag = await Promise.race([
      fetchLatestReleaseTag(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update check timeout')), 3000)
      )
    ]);

    if (latestTag && latestTag !== `v${currentVersion}`) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Kod Güncellemesi Mevcut',
        message: `Uygulama için yeni bir kod güncellemesi mevcut (${latestTag}). Güncellemek ister misiniz?`,
        buttons: ['Evet', 'Hayır']
      }).then(async (result) => {
        if (result.response === 0) { // 'Evet' seçildi
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Güncelleme Başlatılıyor',
            message: 'Kod güncellemeleri indiriliyor ve uygulanıyor. Uygulama yeniden başlatılacak.',
            buttons: ['Tamam']
          });

          const updateUrl = `https://github.com/berketez/LocoDex/releases/download/${latestTag}/source.zip`;
          const tempZipPath = path.join(app.getPath('temp'), 'source_update.zip');
          const appSourcePath = path.join(app.getAppPath()); // Uygulamanın kök dizini

          try {
            await downloadFile(updateUrl, tempZipPath);
            await extractZip(tempZipPath, appSourcePath);
            fs.unlinkSync(tempZipPath); // Geçici zip dosyasını sil

            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Güncelleme Tamamlandı',
              message: 'Kod güncellemeleri başarıyla uygulandı. Uygulama şimdi yeniden başlatılacak.',
              buttons: ['Tamam']
            }).then(() => {
              app.relaunch();
              app.quit();
            });
          } catch (downloadError) {
            dialog.showErrorBox('Güncelleme Hatası', 'Kod güncellemesi indirilirken bir hata oluştu: ' + downloadError.message);
          }
        }
      });
    } else {
      console.log('Kod güncellemesi mevcut değil.');
    }
  } catch (error) {
    console.log('Kod güncelleme kontrolü sırasında hata:', error.message);
    // Hata durumunda uygulamayı kapatmıyoruz, sadece logluyoruz
  }
}

module.exports = { checkAndApplyCodeUpdates };


